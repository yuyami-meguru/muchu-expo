import "server-only";
import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Redis } from "@upstash/redis";
import { SEED } from "./seed";
import type { Dept, News, Place, Shop, ShopState, SiteData, Stock } from "./types";

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
 *   muchu:live   ハッシュ（当日よく変わる物を 1 つずつ。「お店id:state」「お店id:notice」「お店id:nat」（お知らせを出した時刻）「お店id:s:品物id」「お店id:at」）
 *                → 同時に押しても、ほかの人の変更を上書きしない（お店の JSON の state・notice・stock より優先）
 *   muchu:call   ハッシュ（お店から実行委員への呼び出し。id → Call の JSON）
 *   muchu:check  ハッシュ（当日のチェックリスト。項目 id → 印を付けた時刻）
 *   muchu:memo-ack ハッシュ（お店 id → 読んだ「お店の人へ」の連絡の id）
 *   muchu:livelog リスト（当日の動き：営業の状態・売り切れ・お知らせの切り替え。新しい順に 5000 件まで）
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
  live: Record<string, string>;
};
const TABLES = ["dept", "shop", "place", "news", "key", "live"] as const;

interface Backend {
  readAll(): Promise<Raw>;
  /** ハッシュに書く（いくつ書いても 1 回でまとめて書く＝途中でほかの人の書き込みが混ざらない） */
  hset(table: string, values: Record<string, string>): Promise<void>;
  hdel(table: string, ids: string[]): Promise<void>;
  hgetall(table: string): Promise<Record<string, string>>;
  /** ハッシュの 1 件だけ読む（全部読むより安い） */
  hget(table: string, id: string): Promise<string | null>;
  /** 文字の設定をまとめて 1 回で読む（Upstash の回数を 1 回に数える） */
  getMany(keys: string[]): Promise<(string | null)[]>;
  /** はじめのデータを入れる（flag がまだなら）。入れたら true */
  seedOnce(flag: string, raw: Partial<Raw>): Promise<boolean>;
  incr(key: string, ttlSec: number): Promise<number>;
  /** 数えた回数を読むだけ（増やさない） */
  count(key: string): Promise<number>;
  /** リストの先頭に足して（values は古い順。最後のものがいちばん新しくなる）、max 件より古いものを捨てる */
  push(list: string, values: string[], max: number): Promise<void>;
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
    // 編集用のかぎ（key）はここでは読まない（お客さんの画面には要らない。照合は hget で 1 件だけ）
    const tables = TABLES.filter((t) => t !== "key");
    const p = this.r.pipeline();
    for (const t of tables) p.hgetall(`muchu:${t}`);
    const res = (await p.exec()) as unknown[];
    return { ...(Object.fromEntries(tables.map((t, i) => [t, toTable(res[i])])) as Omit<Raw, "key">), key: {} };
  }
  async hset(table: string, values: Record<string, string>) {
    if (!Object.keys(values).length) return;
    await this.r.hset(`muchu:${table}`, values);
  }
  async hdel(table: string, ids: string[]) {
    if (!ids.length) return;
    await this.r.hdel(`muchu:${table}`, ...ids);
  }
  async hgetall(table: string) {
    return toTable(await this.r.hgetall(`muchu:${table}`));
  }
  async hget(table: string, id: string) {
    const v = await this.r.hget(`muchu:${table}`, id);
    return v == null ? null : typeof v === "string" ? v : JSON.stringify(v);
  }
  async getMany(keys: string[]) {
    if (!keys.length) return [];
    const res = (await this.r.mget(...keys.map((k) => `muchu:set:${k}`))) as unknown[];
    return res.map((v) => (v == null ? null : typeof v === "string" ? v : JSON.stringify(v)));
  }
  async seedOnce(flag: string, raw: Partial<Raw>) {
    const first = await this.r.set(`muchu:${flag}`, String(Date.now()), { nx: true });
    if (first !== "OK") return false;
    const p = this.r.pipeline();
    for (const t of TABLES) if (raw[t] && Object.keys(raw[t]).length) p.hset(`muchu:${t}`, raw[t]);
    // はじめのデータには部門も入っている → 部門の目印も立てる（あとで部門を全部消しても入れ直さない）
    if (flag === "seeded") p.set("muchu:seeded:dept", String(Date.now()), { nx: true });
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
  async count(key: string) {
    return Number(await this.r.get(`muchu:rl:${key}`)) || 0;
  }
  async push(list: string, values: string[], max: number) {
    if (!values.length) return;
    const p = this.r.pipeline();
    p.lpush(`muchu:${list}`, ...values);
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
  private data:
    | (Raw & {
        flags?: Record<string, boolean>;
        seeded?: boolean;
        lists?: Record<string, string[]>;
        settings?: Record<string, string>;
        hashes?: Record<string, Record<string, string>>;
      })
    | null = null;
  private counters = new Map<string, { n: number; until: number }>();
  constructor(private readonly writable: boolean) {}
  private load() {
    if (!this.data) {
      try {
        this.data = JSON.parse(readFileSync(this.file, "utf8"));
      } catch {
        this.data = { dept: {}, shop: {}, place: {}, news: {}, key: {}, live: {} };
      }
      // v0.3.0 の手元データには部門の表が無い。v0.10.0 より前には live が無い
      this.data!.dept ??= {};
      this.data!.live ??= {};
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
  /** ハッシュの置き場（読み込みでいつも読む 6 つは上の段、ほかは hashes の中） */
  private table(name: string) {
    const d = this.load();
    if ((TABLES as readonly string[]).includes(name)) return d[name as keyof Raw];
    d.hashes ??= {};
    return (d.hashes[name] ??= {});
  }
  async hset(table: string, values: Record<string, string>) {
    if (!this.writable) throw new StoreNotReady();
    Object.assign(this.table(table), values);
    this.save();
  }
  async hdel(table: string, ids: string[]) {
    if (!this.writable) throw new StoreNotReady();
    const t = this.table(table);
    for (const id of ids) delete t[id];
    this.save();
  }
  async hgetall(table: string) {
    return { ...this.table(table) };
  }
  async hget(table: string, id: string) {
    return this.table(table)[id] ?? null;
  }
  async getMany(keys: string[]) {
    const set = this.load().settings ?? {};
    return keys.map((k) => set[k] ?? null);
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
  async count(key: string) {
    const c = this.counters.get(key);
    return c && c.until > Date.now() ? c.n : 0;
  }
  async push(list: string, values: string[], max: number) {
    if (!this.writable) throw new StoreNotReady();
    const d = this.load();
    d.lists ??= {};
    d.lists[list] = [...[...values].reverse(), ...(d.lists[list] ?? [])].slice(0, max);
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
const g = globalThis as unknown as { __muchuBackendV9?: Backend };
function backend(): Backend {
  if (!g.__muchuBackendV9) {
    const env = redisEnv();
    g.__muchuBackendV9 = env ? new RedisBackend(env.url, env.token) : new FileBackend(process.env.NODE_ENV !== "production");
  }
  return g.__muchuBackendV9;
}

/** 保存先につながっていて書き換えができるか（本番で Upstash が未設定なら false） */
export function storeReady() {
  return !!redisEnv() || process.env.NODE_ENV !== "production";
}

export function newKey() {
  return randomBytes(18).toString("base64url");
}

function seedRaw(): Raw {
  const raw: Raw = { dept: seedDepts(), shop: {}, place: {}, news: {}, key: {}, live: {} };
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

// 同じサーバーの中では 2 秒だけ使い回す（人が多いときに Redis を呼びすぎないため）。
// 書いたら世代を進める → 書く前に読み始めた古い中身を、使い回しに入れない
let cache: { at: number; raw: Raw } | null = null;
let generation = 0;
const CACHE_MS = 2000;
function dropCache() {
  cache = null;
  generation++;
}

async function raw(fresh = false): Promise<Raw> {
  if (!fresh && cache && Date.now() - cache.at < CACHE_MS) return cache.raw;
  const gen = generation;
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
  if (gen === generation) cache = { at: Date.now(), raw: r };
  return r;
}

/* ───── 当日よく変わる物（営業の状態・お知らせ・品物の残り）は muchu:live に 1 つずつ ───── */
const STATES: readonly ShopState[] = ["prep", "open", "break", "closed"];
const STOCKS: readonly Stock[] = ["on", "few", "out"];
type LiveRec = { state?: ShopState; notice?: string; noticeAt?: number; at?: number; stock: Record<string, Stock> };

function liveIndex(live: Record<string, string>) {
  const m = new Map<string, LiveRec>();
  for (const [k, v] of Object.entries(live)) {
    const [shop, field, item] = k.split(":");
    if (!shop || !field) continue;
    let rec = m.get(shop);
    if (!rec) m.set(shop, (rec = { stock: {} }));
    if (field === "state" && STATES.includes(v as ShopState)) rec.state = v as ShopState;
    else if (field === "notice") rec.notice = v;
    else if (field === "nat") rec.noticeAt = Number(v) || 0;
    else if (field === "at") rec.at = Number(v) || 0;
    else if (field === "s" && item && STOCKS.includes(v as Stock)) rec.stock[item] = v as Stock;
  }
  return m;
}

/** お店の JSON に、当日の値（あれば）を重ねる */
function withLive(shop: Shop, l: LiveRec | undefined): Shop {
  if (!l) return shop;
  return {
    ...shop,
    state: l.state ?? shop.state,
    notice: l.notice ?? shop.notice,
    ...(l.noticeAt ? { noticeAt: l.noticeAt } : {}),
    menu: shop.menu.map((m) => (l.stock[m.id] ? { ...m, stock: l.stock[m.id] } : m)),
    updatedAt: Math.max(shop.updatedAt || 0, l.at ?? 0),
  };
}

function parseShop(v: string | undefined): Shop | null {
  if (!v) return null;
  try {
    return JSON.parse(v) as Shop;
  } catch {
    return null;
  }
}

export async function loadAll(opts: { fresh?: boolean } = {}): Promise<SiteData> {
  const r = await raw(opts.fresh);
  const live = liveIndex(r.live);
  return {
    depts: parseAll<Dept>(r.dept).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, "ja")),
    shops: parseAll<Shop>(r.shop)
      .map((s) => withLive(s, live.get(s.id)))
      .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, "ja")),
    places: parseAll<Place>(r.place).sort((a, b) => a.name.localeCompare(b.name, "ja")),
    news: parseAll<News>(r.news).sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.at - a.at),
  };
}

/** お店を 1 つ読む。fresh なら、そのお店の JSON と当日の値だけを読む（全部の表を読むより安い） */
export async function getShop(id: string, opts: { fresh?: boolean } = {}) {
  if (opts.fresh) {
    const [v, live] = await Promise.all([backend().hget("shop", id), backend().hgetall("live")]);
    const shop = parseShop(v ?? undefined);
    return shop ? withLive(shop, liveIndex(live).get(id)) : null;
  }
  const r = await raw();
  const shop = parseShop(r.shop[id]);
  return shop ? withLive(shop, liveIndex(r.live).get(id)) : null;
}

function guard() {
  if (!storeReady()) throw new StoreNotReady();
}

/**
 * お店の中身（名前・紹介・メニューなど）を保存する。営業の状態・お知らせ・品物の残りは saveLive で。
 * メニューから消えた品物の「残り」は消しておく（同じ id の品物をあとで足したとき、古い売り切れが付かないように）
 */
export async function saveShop(shop: Shop) {
  guard();
  await backend().hset("shop", { [shop.id]: JSON.stringify({ ...shop, updatedAt: Date.now() }) });
  const live = await backend().hgetall("live");
  const keep = new Set(shop.menu.map((m) => `${shop.id}:s:${m.id}`));
  const stale = Object.keys(live).filter((k) => k.startsWith(`${shop.id}:s:`) && !keep.has(k));
  if (stale.length) await backend().hdel("live", stale);
  dropCache();
}

export type LivePatch = { state?: ShopState; notice?: string; stock?: Record<string, Stock> };

/** 当日よく変わる物を、お店ごとにまとめて 1 回で書く（ほかの欄・ほかの品物には触らない） */
export async function saveLive(changes: Record<string, LivePatch>) {
  guard();
  const at = String(Date.now());
  const values: Record<string, string> = {};
  for (const [id, c] of Object.entries(changes)) {
    if (c.state !== undefined) values[`${id}:state`] = c.state;
    if (c.notice !== undefined) {
      values[`${id}:notice`] = c.notice;
      values[`${id}:nat`] = at;
    }
    for (const [item, st] of Object.entries(c.stock ?? {})) values[`${id}:s:${item}`] = st;
    if (c.state !== undefined || c.notice !== undefined || Object.keys(c.stock ?? {}).length) values[`${id}:at`] = at;
  }
  await backend().hset("live", values);
  dropCache();
}

export async function deleteShop(id: string) {
  guard();
  const live = await backend().hgetall("live");
  await backend().hdel("shop", [id]);
  await backend().hdel("key", [id]);
  await backend().hdel("live", Object.keys(live).filter((k) => k.startsWith(`${id}:`)));
  dropCache();
}
export async function saveDept(d: Dept) {
  guard();
  await backend().hset("dept", { [d.id]: JSON.stringify(d) });
  dropCache();
}
export async function deleteDept(id: string) {
  guard();
  await backend().hdel("dept", [id]);
  dropCache();
}
export async function savePlace(p: Place) {
  guard();
  await backend().hset("place", { [p.id]: JSON.stringify(p) });
  dropCache();
}
export async function deletePlace(id: string) {
  guard();
  await backend().hdel("place", [id]);
  dropCache();
}
export async function saveNews(n: News) {
  guard();
  await backend().hset("news", { [n.id]: JSON.stringify(n) });
  dropCache();
}
export async function deleteNews(id: string) {
  guard();
  await backend().hdel("news", [id]);
  dropCache();
}

/** お店の編集用のかぎ（なければ作る） */
export async function shopKey(id: string): Promise<string | null> {
  if (!(await backend().hget("shop", id))) return null;
  const cur = await backend().hget("key", id);
  if (cur) return cur;
  guard();
  const k = newKey();
  await backend().hset("key", { [id]: k });
  dropCache();
  return k;
}
export async function rotateShopKey(id: string) {
  guard();
  const k = newKey();
  await backend().hset("key", { [id]: k });
  dropCache();
  return k;
}
/** かぎの照合用（いつも最新を読む。お店の人の画面は何度も呼ぶので、そのお店の 1 件だけ読む） */
export async function storedShopKey(id: string): Promise<string | null> {
  return backend().hget("key", id);
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
  // まとめて 1 回で先頭に足す（あとのものほど新しい）
  await backend().push("log", entries.map((e) => JSON.stringify(e)), LOG_MAX);
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

/** 回数の上限（window 秒のあいだに limit 回まで）。数えて、超えたら false */
export async function allow(bucket: string, limit: number, windowSec: number) {
  const n = await backend().incr(bucket, windowSec);
  return n <= limit;
}
/** まちがいの回数がもう上限に来ているか（数えない。まちがえたときだけ allow で数える） */
export async function blocked(bucket: string, limit: number) {
  return (await backend().count(bucket)) >= limit;
}

/* ───── アンケート（お客さんの回答。名前などは聞かない） ───── */
const SURVEY_MAX = 20000;

export async function addSurvey(json: string) {
  guard();
  await backend().push("survey", [json], SURVEY_MAX);
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
/** 文字の設定をまとめて読む（1 回で読む。並びは keys と同じ） */
export async function getSettings(keys: string[]) {
  return backend().getMany(keys);
}
/** 文字の設定を書く（JSON を入れてもよい） */
export async function setSetting(key: string, value: string) {
  guard();
  await backend().setStr(key, value);
}
/** リストの先頭に足す（max 件より古いものは捨てる） */
export async function pushList(name: string, value: string, max: number) {
  guard();
  await backend().push(name, [value], max);
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

/** ハッシュ（id → 文字）を読む・書く・消す。呼び出し・チェックリストなど、1 件ずつ別々に変わる物に使う */
export async function readHash(name: string) {
  return backend().hgetall(name);
}
export async function readHashOne(name: string, id: string) {
  return backend().hget(name, id);
}
export async function writeHash(name: string, values: Record<string, string>) {
  guard();
  await backend().hset(name, values);
}
export async function removeHash(name: string, ids: string[]) {
  guard();
  await backend().hdel(name, ids);
}

/* ───── 当日の動き（営業の状態・売り切れ・お知らせの切り替え。振り返りと来年の仕込みの参考に） ───── */
export type LiveLogEntry = {
  at: number;
  /** "admin"（実行委員）か、お店の id（お店の人） */
  by: string;
  shop: string;
  kind: "state" | "stock" | "notice";
  /** 品物の id（kind が stock のとき） */
  item?: string;
  value: string;
};
const LIVELOG_MAX = 5000;

export async function addLiveLog(entries: LiveLogEntry[]) {
  if (!entries.length || !storeReady()) return;
  await backend().push("livelog", entries.map((e) => JSON.stringify(e)), LIVELOG_MAX);
}

export async function listLiveLog(n = LIVELOG_MAX): Promise<LiveLogEntry[]> {
  const out: LiveLogEntry[] = [];
  for (const v of await backend().list("livelog", n)) {
    try {
      out.push(typeof v === "string" ? (JSON.parse(v) as LiveLogEntry) : (v as LiveLogEntry));
    } catch {
      // 壊れた 1 件は飛ばす
    }
  }
  return out;
}
