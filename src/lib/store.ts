import "server-only";
import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Redis } from "@upstash/redis";
import { SEED } from "./seed";
import type { Dept, News, Place, Shop, SiteData } from "./types";

/*
 * 保存先。本番は Upstash Redis（Vercel で Upstash をつなぐと KV_REST_API_URL・KV_REST_API_TOKEN が入る）。
 * 手元（next dev）で Upstash の設定がなければ .data/dev.json に保存する。
 * 本番で設定がないときは、はじめのデータを見せるだけで書き換えはできない（StoreNotReady を投げる）。
 *
 * Redis の中身：
 *   muchu:dept   ハッシュ（部門の id → Dept の JSON）
 *   muchu:shop   ハッシュ（お店の id → Shop の JSON）
 *   muchu:place  ハッシュ（場所の id → Place の JSON）
 *   muchu:news   ハッシュ（お知らせの id → News の JSON）
 *   muchu:key    ハッシュ（お店の id → 編集用のかぎ）
 *   muchu:log    リスト（変更の記録。新しい順に 500 件まで。LogEntry の JSON）
 *   muchu:survey リスト（アンケートの回答。新しい順に 20000 件まで。SurveyAnswer の JSON）
 *   muchu:set:○○ 文字の設定（muchu:set:surveyOpen＝"1"/"0" など）
 *   muchu:seeded はじめのデータを入れたかどうか（部門は v0.4.0 から。muchu:seeded:dept）
 */

export class StoreNotReady extends Error {
  constructor() {
    super("保存先（Upstash）がまだつながっていません");
  }
}

type Raw = {
  dept: Record<string, string>;
  shop: Record<string, string>;
  place: Record<string, string>;
  news: Record<string, string>;
  key: Record<string, string>;
};
const TABLES = ["dept", "shop", "place", "news", "key"] as const;

interface Backend {
  readAll(): Promise<Raw>;
  hset(table: keyof Raw, id: string, value: string): Promise<void>;
  hdel(table: keyof Raw, id: string): Promise<void>;
  /** はじめのデータを入れる（flag がまだなら）。入れたら true */
  seedOnce(flag: string, raw: Partial<Raw>): Promise<boolean>;
  incr(key: string, ttlSec: number): Promise<number>;
  /** リストの先頭に足して、max 件より古いものを捨てる */
  push(list: string, value: string, max: number): Promise<void>;
  /** リストの先頭から n 件 */
  list(list: string, n: number): Promise<string[]>;
  /** リストを空にする */
  clear(list: string): Promise<void>;
  /** 文字の設定 */
  getStr(key: string): Promise<string | null>;
  setStr(key: string, value: string): Promise<void>;
}

function redisEnv() {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url, token } : null;
}

/**
 * hgetall の答えを「id → 文字」の表にそろえる。
 * automaticDeserialization: false にすると、Upstash は hgetall の答えを表に組み立てず、[id, 中身, id, 中身…] の並びのまま返す
 * （2026-10-30 に本番で、お店を id で探せず 404 になった原因）。表で返ってきたときもそのまま使えるようにする。
 */
export function toTable(x: unknown): Record<string, string> {
  if (!x) return {};
  const str = (v: unknown) => (typeof v === "string" ? v : JSON.stringify(v));
  if (Array.isArray(x)) {
    const out: Record<string, string> = {};
    for (let i = 0; i + 1 < x.length; i += 2) out[String(x[i])] = str(x[i + 1]);
    return out;
  }
  if (typeof x === "object") return Object.fromEntries(Object.entries(x as Record<string, unknown>).map(([k, v]) => [k, str(v)]));
  return {};
}

class RedisBackend implements Backend {
  private r: Redis;
  constructor(url: string, token: string) {
    this.r = new Redis({ url, token, automaticDeserialization: false });
  }
  async readAll(): Promise<Raw> {
    const p = this.r.pipeline();
    for (const t of TABLES) p.hgetall(`muchu:${t}`);
    const res = (await p.exec()) as unknown[];
    return Object.fromEntries(TABLES.map((t, i) => [t, toTable(res[i])])) as Raw;
  }
  async hset(table: keyof Raw, id: string, value: string) {
    await this.r.hset(`muchu:${table}`, { [id]: value });
  }
  async hdel(table: keyof Raw, id: string) {
    await this.r.hdel(`muchu:${table}`, id);
  }
  async seedOnce(flag: string, raw: Partial<Raw>) {
    const first = await this.r.set(`muchu:${flag}`, String(Date.now()), { nx: true });
    if (first !== "OK") return false;
    const p = this.r.pipeline();
    for (const t of TABLES) if (raw[t] && Object.keys(raw[t]).length) p.hset(`muchu:${t}`, raw[t]);
    await p.exec();
    return true;
  }
  async incr(key: string, ttlSec: number) {
    const p = this.r.pipeline();
    p.incr(`muchu:rl:${key}`);
    p.expire(`muchu:rl:${key}`, ttlSec, "NX");
    const [n] = (await p.exec()) as [number, number];
    return n;
  }
  async push(list: string, value: string, max: number) {
    const p = this.r.pipeline();
    p.lpush(`muchu:${list}`, value);
    p.ltrim(`muchu:${list}`, 0, max - 1);
    await p.exec();
  }
  async list(list: string, n: number) {
    return ((await this.r.lrange(`muchu:${list}`, 0, n - 1)) as string[]) ?? [];
  }
  async clear(list: string) {
    await this.r.del(`muchu:${list}`);
  }
  async getStr(key: string) {
    return ((await this.r.get(`muchu:set:${key}`)) as string | null) ?? null;
  }
  async setStr(key: string, value: string) {
    await this.r.set(`muchu:set:${key}`, value);
  }
}

/** 手元用。プロセスの中に持ち、.data/dev.json にも書く（next dev を止めても残る） */
class FileBackend implements Backend {
  private file = join(process.cwd(), ".data", "dev.json");
  private data: (Raw & { flags?: Record<string, boolean>; seeded?: boolean; lists?: Record<string, string[]>; settings?: Record<string, string> }) | null = null;
  private counters = new Map<string, { n: number; until: number }>();
  constructor(private readonly writable: boolean) {}
  private load() {
    if (!this.data) {
      try {
        this.data = JSON.parse(readFileSync(this.file, "utf8"));
      } catch {
        this.data = { dept: {}, shop: {}, place: {}, news: {}, key: {} };
      }
      // v0.3.0 の手元データには部門の表が無い
      this.data!.dept ??= {};
      this.data!.flags ??= this.data!.seeded ? { seeded: true } : {};
    }
    return this.data!;
  }
  private save() {
    if (!this.writable) return;
    mkdirSync(join(process.cwd(), ".data"), { recursive: true });
    writeFileSync(this.file, JSON.stringify(this.data, null, 2));
  }
  async readAll() {
    const d = this.load();
    return Object.fromEntries(TABLES.map((t) => [t, { ...d[t] }])) as Raw;
  }
  async hset(table: keyof Raw, id: string, value: string) {
    if (!this.writable) throw new StoreNotReady();
    this.load()[table][id] = value;
    this.save();
  }
  async hdel(table: keyof Raw, id: string) {
    if (!this.writable) throw new StoreNotReady();
    delete this.load()[table][id];
    this.save();
  }
  async seedOnce(flag: string, raw: Partial<Raw>) {
    const d = this.load();
    if (d.flags![flag]) return false;
    for (const t of TABLES) if (raw[t]) Object.assign(d[t], raw[t]);
    d.flags![flag] = true;
    this.save();
    return true;
  }
  async incr(key: string, ttlSec: number) {
    const now = Date.now();
    const c = this.counters.get(key);
    const next = c && c.until > now ? { n: c.n + 1, until: c.until } : { n: 1, until: now + ttlSec * 1000 };
    this.counters.set(key, next);
    return next.n;
  }
  async push(list: string, value: string, max: number) {
    if (!this.writable) throw new StoreNotReady();
    const d = this.load();
    d.lists ??= {};
    d.lists[list] = [value, ...(d.lists[list] ?? [])].slice(0, max);
    this.save();
  }
  async list(list: string, n: number) {
    return (this.load().lists?.[list] ?? []).slice(0, n);
  }
  async clear(list: string) {
    if (!this.writable) throw new StoreNotReady();
    const d = this.load();
    if (d.lists) delete d.lists[list];
    this.save();
  }
  async getStr(key: string) {
    return this.load().settings?.[key] ?? null;
  }
  async setStr(key: string, value: string) {
    if (!this.writable) throw new StoreNotReady();
    const d = this.load();
    d.settings = { ...(d.settings ?? {}), [key]: value };
    this.save();
  }
}

// 開発中の作り直し（HMR）で古い形の保存先が残らないよう、形を変えたら名前の数字を上げる
const g = globalThis as unknown as { __muchuBackendV6?: Backend };
function backend(): Backend {
  if (!g.__muchuBackendV6) {
    const env = redisEnv();
    g.__muchuBackendV6 = env ? new RedisBackend(env.url, env.token) : new FileBackend(process.env.NODE_ENV !== "production");
  }
  return g.__muchuBackendV6;
}

/** 保存先につながっていて書き換えができるか（本番で Upstash が未設定なら false） */
export function storeReady() {
  return !!redisEnv() || process.env.NODE_ENV !== "production";
}

export function newKey() {
  return randomBytes(18).toString("base64url");
}

function seedRaw(): Raw {
  const raw: Raw = { dept: seedDepts(), shop: {}, place: {}, news: {}, key: {} };
  for (const s of SEED.shops) {
    raw.shop[s.id] = JSON.stringify(s);
    raw.key[s.id] = newKey();
  }
  for (const p of SEED.places) raw.place[p.id] = JSON.stringify(p);
  return raw;
}

function seedDepts() {
  return Object.fromEntries(SEED.depts.map((d) => [d.id, JSON.stringify(d)]));
}

function parseAll<T>(rec: Record<string, string>): T[] {
  const out: T[] = [];
  for (const v of Object.values(rec)) {
    try {
      out.push(JSON.parse(v) as T);
    } catch {
      // 壊れた 1 件は飛ばす
    }
  }
  return out;
}

// 同じサーバーの中では 2 秒だけ使い回す（人が多いときに Redis を呼びすぎないため）
let cache: { at: number; raw: Raw } | null = null;
const CACHE_MS = 2000;

async function raw(fresh = false): Promise<Raw> {
  if (!fresh && cache && Date.now() - cache.at < CACHE_MS) return cache.raw;
  const b = backend();
  let r = await b.readAll();
  if (!Object.keys(r.shop).length) {
    if (storeReady()) {
      await b.seedOnce("seeded", seedRaw());
      r = await b.readAll();
    } else {
      r = { ...seedRaw(), key: {} };
    }
  }
  // v0.3.0 で始めたデータには部門が無い → はじめの部門を 1 度だけ入れる（そのあと全部消しても入れ直さない）
  if (!Object.keys(r.dept).length) {
    if (storeReady()) {
      if (await b.seedOnce("seeded:dept", { dept: seedDepts() })) r = await b.readAll();
    } else {
      r = { ...r, dept: seedDepts() };
    }
  }
  cache = { at: Date.now(), raw: r };
  return r;
}

export async function loadAll(opts: { fresh?: boolean } = {}): Promise<SiteData> {
  const r = await raw(opts.fresh);
  return {
    depts: parseAll<Dept>(r.dept).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, "ja")),
    shops: parseAll<Shop>(r.shop).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, "ja")),
    places: parseAll<Place>(r.place).sort((a, b) => a.name.localeCompare(b.name, "ja")),
    news: parseAll<News>(r.news).sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.at - a.at),
  };
}

export async function getShop(id: string, opts: { fresh?: boolean } = {}) {
  const r = await raw(opts.fresh);
  const v = r.shop[id];
  return v ? (JSON.parse(v) as Shop) : null;
}

function guard() {
  if (!storeReady()) throw new StoreNotReady();
}

export async function saveShop(shop: Shop) {
  guard();
  await backend().hset("shop", shop.id, JSON.stringify({ ...shop, updatedAt: Date.now() }));
  cache = null;
}
export async function deleteShop(id: string) {
  guard();
  await backend().hdel("shop", id);
  await backend().hdel("key", id);
  cache = null;
}
export async function saveDept(d: Dept) {
  guard();
  await backend().hset("dept", d.id, JSON.stringify(d));
  cache = null;
}
export async function deleteDept(id: string) {
  guard();
  await backend().hdel("dept", id);
  cache = null;
}
export async function savePlace(p: Place) {
  guard();
  await backend().hset("place", p.id, JSON.stringify(p));
  cache = null;
}
export async function deletePlace(id: string) {
  guard();
  await backend().hdel("place", id);
  cache = null;
}
export async function saveNews(n: News) {
  guard();
  await backend().hset("news", n.id, JSON.stringify(n));
  cache = null;
}
export async function deleteNews(id: string) {
  guard();
  await backend().hdel("news", id);
  cache = null;
}

/** お店の編集用のかぎ（なければ作る） */
export async function shopKey(id: string): Promise<string | null> {
  const r = await raw(true);
  if (!r.shop[id]) return null;
  if (r.key[id]) return r.key[id];
  guard();
  const k = newKey();
  await backend().hset("key", id, k);
  cache = null;
  return k;
}
export async function rotateShopKey(id: string) {
  guard();
  const k = newKey();
  await backend().hset("key", id, k);
  cache = null;
  return k;
}
/** かぎの照合用（いつも最新を読む） */
export async function storedShopKey(id: string): Promise<string | null> {
  const r = await raw(true);
  return r.key[id] ?? null;
}

/* ───── 変更の記録（だれが・いつ・どのお店の・何を変えたか） ───── */
export type LogEntry = {
  at: number;
  /** "admin"（実行委員）か、お店の id（お店の人） */
  by: string;
  shop: string;
  shopName: string;
  /** 欄の名前（「どんなお店？」など） */
  field: string;
  before: string;
  after: string;
};
const LOG_MAX = 500;

export async function addLog(entries: LogEntry[]) {
  if (!entries.length || !storeReady()) return;
  // 1 件ずつ先頭に足す（あとに足したものほど新しい）
  for (const e of entries) await backend().push("log", JSON.stringify(e), LOG_MAX);
}

export async function listLog(n = LOG_MAX): Promise<LogEntry[]> {
  const raw = await backend().list("log", n);
  const out: LogEntry[] = [];
  for (const v of raw) {
    try {
      out.push(typeof v === "string" ? (JSON.parse(v) as LogEntry) : (v as LogEntry));
    } catch {
      // 壊れた 1 件は飛ばす
    }
  }
  return out;
}

/** 回数の上限（window 秒のあいだに limit 回まで）。超えたら false */
export async function allow(bucket: string, limit: number, windowSec: number) {
  const n = await backend().incr(bucket, windowSec);
  return n <= limit;
}

/* ───── アンケート（お客さんの回答。名前などは聞かない） ───── */
const SURVEY_MAX = 20000;

export async function addSurvey(json: string) {
  guard();
  await backend().push("survey", json, SURVEY_MAX);
}

export async function listSurvey(): Promise<unknown[]> {
  const raw = await backend().list("survey", SURVEY_MAX);
  const out: unknown[] = [];
  for (const v of raw) {
    try {
      out.push(typeof v === "string" ? JSON.parse(v) : v);
    } catch {
      // 壊れた 1 件は飛ばす
    }
  }
  return out;
}

export async function clearSurvey() {
  guard();
  await backend().clear("survey");
}

/** アンケートを受け付けているか（はじめは受け付ける） */
export async function surveyOpen() {
  return (await backend().getStr("surveyOpen")) !== "0";
}

export async function setSurveyOpen(open: boolean) {
  guard();
  await backend().setStr("surveyOpen", open ? "1" : "0");
}

/* ───── 共通の道具（ラジオ・アワードなど、あとから足す機能で使う） ───── */
/** 文字の設定を読む（なければ null） */
export async function getSetting(key: string) {
  return backend().getStr(key);
}
/** 文字の設定を書く（JSON を入れてもよい） */
export async function setSetting(key: string, value: string) {
  guard();
  await backend().setStr(key, value);
}
/** リストの先頭に足す（max 件より古いものは捨てる） */
export async function pushList(name: string, value: string, max: number) {
  guard();
  await backend().push(name, value, max);
}
/** リストの先頭から n 件（新しい順） */
export async function readList(name: string, n: number) {
  return backend().list(name, n);
}
/** リストを空にする */
export async function clearList(name: string) {
  guard();
  await backend().clear(name);
}
