import "server-only";
import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Redis } from "@upstash/redis";
import { unstable_rethrow } from "next/navigation";
import { SEED } from "./seed";
import { FLOOR_SEED } from "./floor-plans";
import { LIVE_TIMING, parsePhaseMode, phaseOf } from "./ops";
import { RADIO_SHOP } from "./radio-shop";
import { DEFAULT_LAYOUT, isMapPlaceId, layoutPlaces, parseLayout, type OutLayout } from "./outside-plan";
import { PLACE_KINDS, TONES, type Area, type Dept, type Kind, type MenuItem, type News, type Place, type Shop, type ShopState, type SiteData, type Stock } from "./types";

/*
 * 保存先。本番は Upstash Redis（Vercel で Upstash をつなぐと KV_REST_API_URL・KV_REST_API_TOKEN が入る）。
 * 手元（next dev）で Upstash の設定がなければ .data/dev.json に保存する。
 * 本番で設定がないときは、はじめのデータを見せるだけで書き換えはできない（StoreNotReady を投げる）。
 *
 * Redis の中身：
 *   muchu:dept   ハッシュ（部門の id → Dept の JSON）
 *   muchu:shop   ハッシュ（お店の id → Shop の JSON）
 *   muchu:place  ハッシュ（場所の id → Place の JSON。外のピンも、フロアの部屋の四角も）
 *   muchu:area   ハッシュ（フロアの id → Area の JSON。外は入れない。はじめの 2〜4 階は muchu:seeded:areas で 1 度だけ入れた）
 *   muchu:news   ハッシュ（お知らせの id → News の JSON）
 *   muchu:key    ハッシュ（お店の id → 編集用のかぎ）
 *   muchu:live   ハッシュ（当日よく変わる物を 1 つずつ。「お店id:state」「お店id:notice」「お店id:nat」（お知らせを出した時刻）「お店id:s:品物id」「お店id:at」）
 *                → 同時に押しても、ほかの人の変更を上書きしない（お店の JSON の state・notice・stock より優先）
 *   muchu:check  ハッシュ（当日のチェックリスト。項目 id → 印を付けた時刻）
 *   muchu:memo-ack ハッシュ（お店 id → 読んだ「お店の人へ」の連絡の id）
 *   muchu:livelog リスト（当日の動き：営業の状態・売り切れ・お知らせの切り替え。新しい順に 5000 件まで）
 *   muchu:log    リスト（変更の記録。新しい順に 500 件まで。LogEntry の JSON）
 *   muchu:survey リスト（アンケートの回答。新しい順に 20000 件まで。SurveyAnswer の JSON）
 *   muchu:set:○○ 文字の設定（muchu:set:surveyOpen＝"1"/"0" など。表示の時期 phase は v0.12.0 から「during|時刻」の形もある：ops.ts）
 *   muchu:seeded はじめのデータを入れたかどうか（部門は v0.4.0 から。muchu:seeded:dept）
 *
 * Upstash は命令 1 つずつを数える（pipeline の中も 1 つずつ。無料枠は月 50 万）。なので読みはなるべく使い回す（下の「読みの使い回し」）。
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
  area: Record<string, string>;
  /** 外の会場マップの配置（v0.22.0。"layout" に JSON 1 つ。無ければはじめの配置） */
  omap: Record<string, string>;
};
const TABLES = ["dept", "shop", "place", "news", "key", "live", "area", "omap"] as const;
/** 当日よく変わる表（ほかの表より短い間だけ使い回す） */
const LIVE_TABLES = ["live", "news"] as const;

interface Backend {
  readAll(): Promise<Raw>;
  /** いくつかのハッシュをまとめて読む（1 回の通信。Upstash の回数は表の数だけ） */
  readTables(tables: readonly string[]): Promise<Record<string, Record<string, string>>>;
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
  /** 目印を立てる（まだ立っていなければ）。立てたら true（1 度だけの直しに使う） */
  flagOnce(flag: string): Promise<boolean>;
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

/**
 * Upstash への 1 回の通信を待つ長さ（試し直しも含めて）。@upstash/redis には時間切れが無く、Node の既定は 300 秒なので、
 * 返事が来ないと、そのページ・窓口（と、相乗りした読み）が止まり続ける。時間切れは投げる（guarded・error.tsx が日本語で出す）
 */
const REDIS_TIMEOUT_MS = 8000;

class RedisBackend implements Backend {
  private r: Redis;
  constructor(url: string, token: string) {
    // signal は関数で渡す（通信のたびに新しい時間切れ。関数でない signal だと、切れたときに「答えなし」として扱われてしまう）
    this.r = new Redis({ url, token, automaticDeserialization: false, signal: () => AbortSignal.timeout(REDIS_TIMEOUT_MS) });
  }
  async readAll(): Promise<Raw> {
    // 編集用のかぎ（key）はここでは読まない（お客さんの画面には要らない。照合は hget で 1 件だけ）
    const t = await this.readTables(TABLES.filter((x) => x !== "key"));
    return { dept: t.dept, shop: t.shop, place: t.place, news: t.news, live: t.live, area: t.area, omap: t.omap, key: {} };
  }
  async readTables(tables: readonly string[]) {
    const p = this.r.pipeline();
    for (const t of tables) p.hgetall(`muchu:${t}`);
    const res = (await p.exec()) as unknown[];
    return Object.fromEntries(tables.map((t, i) => [t, toTable(res[i])]));
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
  async flagOnce(flag: string) {
    return (await this.r.set(`muchu:${flag}`, String(Date.now()), { nx: true })) === "OK";
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
        this.data = { dept: {}, shop: {}, place: {}, news: {}, key: {}, live: {}, area: {}, omap: {} };
      }
      // v0.3.0 の手元データには部門の表が無い。v0.10.0 より前には live が、v0.11.0 より前には area が無い
      this.data!.dept ??= {};
      this.data!.live ??= {};
      this.data!.area ??= {};
      this.data!.omap ??= {};
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
  async readTables(tables: readonly string[]) {
    return Object.fromEntries(tables.map((t) => [t, { ...this.table(t) }]));
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
  async flagOnce(flag: string) {
    if (!this.writable) throw new StoreNotReady();
    const d = this.load();
    if (d.flags![flag]) return false;
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
// （V11：readTables を足した。V17：flagOnce を足した。V19：表 omap（外の配置）を足した。手元の中身は .data/dev.json から読み直すので消えない）
const g = globalThis as unknown as { __muchuBackendV19?: Backend };
function backend(): Backend {
  if (!g.__muchuBackendV19) {
    const env = redisEnv();
    g.__muchuBackendV19 = env ? new RedisBackend(env.url, env.token) : new FileBackend(process.env.NODE_ENV !== "production");
  }
  return g.__muchuBackendV19;
}

/** 保存先につながっていて書き換えができるか（本番で Upstash が未設定なら false） */
export function storeReady() {
  return !!redisEnv() || process.env.NODE_ENV !== "production";
}

export function newKey() {
  return randomBytes(18).toString("base64url");
}

function seedRaw(): Raw {
  const raw: Raw = { dept: seedDepts(), shop: {}, place: {}, news: {}, key: {}, live: {}, area: {}, omap: {} };
  for (const s of SEED.shops) {
    raw.shop[s.id] = JSON.stringify(s);
    raw.key[s.id] = newKey();
  }
  for (const p of SEED.places) raw.place[p.id] = JSON.stringify(p);
  return raw;
}

/** はじめのフロア（2〜4 階の見取り図）と、その部屋の四角・トイレ・玄関のピン */
function seedFloors(): Partial<Raw> {
  return {
    area: Object.fromEntries(FLOOR_SEED.areas.map((a) => [a.id, JSON.stringify(a)])),
    place: Object.fromEntries(FLOOR_SEED.places.map((p) => [p.id, JSON.stringify(p)])),
  };
}

function seedDepts() {
  return Object.fromEntries(SEED.depts.map((d) => [d.id, JSON.stringify(d)]));
}

/* ───── 読んだ JSON の形を確かめる（壊れた 1 件で全部のページが落ちないように。足りない欄は空で補う） ───── */
const STATES: readonly ShopState[] = ["prep", "open", "break", "closed"];
const STOCKS: readonly Stock[] = ["on", "few", "out"];
const KINDS: readonly Kind[] = ["eat", "play", "see"];
const TONE_VALUES = TONES.map((t) => t.value) as readonly string[];
const PLACE_KIND_VALUES = PLACE_KINDS.map((k) => k.value) as readonly string[];

const str = (v: unknown, d = "") => (typeof v === "string" ? v : d);
const num = (v: unknown, d = 0) => (typeof v === "number" && Number.isFinite(v) ? v : d);
function objOf(v: string | null | undefined): Record<string, unknown> | null {
  if (!v) return null;
  try {
    const o = JSON.parse(v) as unknown;
    return o && typeof o === "object" && !Array.isArray(o) ? (o as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** お店の JSON。名前の無い（壊れた）お店は、お客さんには出さない（実行委員の画面では見えるので直せる） */
function asShop(key: string, v: string | null | undefined): Shop | null {
  const o = objOf(v);
  if (!o) return null;
  const id = str(o.id) || key;
  const name = str(o.name);
  const menu = Array.isArray(o.menu) ? (o.menu as unknown[]) : [];
  const schedule = Array.isArray(o.schedule) ? (o.schedule as unknown[]) : [];
  return {
    ...(o as Partial<Shop>),
    id,
    dept: str(o.dept),
    kind: KINDS.includes(o.kind as Kind) ? (o.kind as Kind) : "see",
    name: name || id,
    catch: str(o.catch),
    description: str(o.description),
    message: str(o.message),
    placeId: str(o.placeId),
    placeNote: str(o.placeNote),
    menu: menu
      .filter((m): m is Record<string, unknown> => !!m && typeof m === "object" && typeof (m as { id?: unknown }).id === "string")
      .map((m): MenuItem => ({ id: m.id as string, name: str(m.name) || (m.id as string), price: str(m.price), note: str(m.note), stock: STOCKS.includes(m.stock as Stock) ? (m.stock as Stock) : "on" })),
    schedule: schedule.filter((x): x is Record<string, unknown> => !!x && typeof x === "object").map((x) => ({ time: str(x.time), text: str(x.text) })),
    state: STATES.includes(o.state as ShopState) ? (o.state as ShopState) : "prep",
    notice: str(o.notice),
    noticeAt: typeof o.noticeAt === "number" ? o.noticeAt : undefined,
    hidden: o.hidden === true || !name,
    order: num(o.order, 9999),
    updatedAt: num(o.updatedAt, 0),
  };
}

function asDept(key: string, v: string): Dept | null {
  const o = objOf(v);
  if (!o) return null;
  const id = str(o.id) || key;
  const name = str(o.name) || id;
  return { id, name, short: str(o.short) || name, tagline: str(o.tagline), color: (TONE_VALUES.includes(str(o.color)) ? o.color : "brown") as Dept["color"], order: num(o.order, 9999) };
}

function asPlace(key: string, v: string): Place | null {
  const o = objOf(v);
  if (!o) return null;
  const id = str(o.id) || key;
  const p: Place = { id, name: str(o.name) || id, x: num(o.x, 50), y: num(o.y, 50), note: str(o.note) };
  if (PLACE_KIND_VALUES.includes(str(o.kind))) p.kind = o.kind as Place["kind"];
  if (str(o.area)) p.area = o.area as string;
  if (typeof o.w === "number" && typeof o.h === "number") {
    p.w = o.w;
    p.h = o.h;
  }
  return p;
}

function asArea(key: string, v: string): Area | null {
  const o = objOf(v);
  if (!o) return null;
  const id = str(o.id) || key;
  return { id, building: str(o.building) || id, floor: str(o.floor), order: num(o.order, 9999), ...(str(o.plan) ? { plan: o.plan as string } : {}) };
}

function asNews(key: string, v: string): News | null {
  const o = objOf(v);
  if (!o || !str(o.text)) return null;
  return { id: str(o.id) || key, text: str(o.text), at: num(o.at), pinned: o.pinned === true };
}

function parseTable<T>(rec: Record<string, string>, as: (key: string, v: string) => T | null): T[] {
  const out: T[] = [];
  for (const [k, v] of Object.entries(rec)) {
    const x = as(k, v);
    if (x) out.push(x);
  }
  return out;
}

/**
 * 並びが同じときの最後の決め手（id）。Upstash の hgetall は、大きいハッシュでは入れた順に返らない（手元の .data/dev.json は入れた順）。
 * 同じ名前のピン（各階の「トイレ」など）の並びが、台や読み直しのたびに変わらないように
 */
const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

const sortNews = (list: News[]) => list.sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.at - a.at || byId(a, b));

/* ───── 読みの使い回し（Upstash の回数を増やさないため） ─────
 * 同じサーバーの中だけで使い回す（Vercel の関数は何台かに分かれるので、ほかの台の書き込みは、使い回す古さの分だけ遅れて入る）。
 *  - 表を 2 つに分ける：content（部門・お店・場所・フロア。めったに変わらない）と live（当日の値・全体のお知らせ。よく変わる）
 *  - 読みかけがあれば相乗りする（ページの枠と中身が同時に読んでも、Redis へは 1 回）。ただし始めてから JOIN_MS より前の読みには
 *    相乗りしない（返事が来ないまま止まった 1 回の読みに、その台のお客さんの全部のページが巻きこまれないように）
 *  - 書いたら世代を進める → 書く前に読み始めた古い中身を、使い回しに入れない。fresh の読みはいつも Redis から
 *  - どれだけ古くてよいかは、読む人で決める（どれも 1 台の中で 10 秒まで）：
 *      お客さん …… 表示の時期で（ops.ts の LIVE_TIMING。開催中は当日の値 3 秒・中身 10 秒、ほかは 10 秒）
 *      従業員がページを開いた …… 2 秒（いままでどおり。設定はいつも新しく）。だれかは、署名が合って期限内のクッキー（muchu_staff）で見る
 *      （クッキーが「あるだけ」にすると、でたらめのクッキーで使い回しを外して、Upstash の回数を増やせてしまう）
 *      従業員の画面の 15 秒ごとの読み直し …… STAFF_POLL_READ（押したあとの読み直しは fresh）
 *  - 開発中の作り直し（HMR）や、ページと API で写しが別になっても同じものを使うよう、globalThis に置く
 */

/** 使い回してよい古さ（ミリ秒。0 なら使い回さない）。content＝部門・お店・場所・フロア、live＝当日の値と全体のお知らせ、set＝文字の設定 */
export type ReadWindow = { content: number; live: number; set: number };
/** 読み方。fresh ならいつも新しく、read を渡せばその古さまで、どちらも無ければ読む人（お客さんか従業員か）で決める */
export type ReadOpts = { fresh?: boolean; read?: ReadWindow };

export const FRESH_READ: ReadWindow = { content: 0, live: 0, set: 0 };
const STAFF_PAGE_READ: ReadWindow = { content: 2000, live: 2000, set: 0 };
/** 従業員の画面の 15 秒ごとの読み直し（GET /api/staff/live。押したあとの読み直しは fresh で読む） */
export const STAFF_POLL_READ: ReadWindow = { content: 10_000, live: 5000, set: 5000 };

/** 読みかけ（相乗りの置き場）。at＝読み始めた時刻 */
type Shared<T> = { gen: number; at: number; p: Promise<T> };
/** 読みかけに相乗りしてよい長さ。これより前に始めて、まだ返事の無い読みは待たずに、新しく読み直す（ふだんの読みは 0.1 秒もかからない） */
const JOIN_MS = 3000;
/** その読みかけに相乗りしてよいか（同じ世代で、始めてから JOIN_MS まで） */
function joinable<T>(s: Shared<T> | null, gen: number): s is Shared<T> {
  return !!s && s.gen === gen && Date.now() - s.at < JOIN_MS;
}
type Mem = {
  /** 書いた回数（書いたら進める） */
  gen: number;
  raw: Raw | null;
  contentAt: number;
  liveAt: number;
  allP: Shared<Raw> | null;
  liveP: Shared<Pick<Raw, "live" | "news">> | null;
  setGen: number;
  sets: Map<string, { v: string | null; at: number }>;
  setP: Shared<void> | null;
  keyGen: number;
  keys: { at: number; t: Record<string, string> } | null;
  keyP: Shared<Record<string, string>> | null;
  hashGen: number;
  hashes: Map<string, { at: number; t: Record<string, string> }>;
  /** このサーバーの中だけで数える回数（allowHere） */
  hits: Map<string, { n: number; until: number }>;
  /** 従業員の画面の読み直しが来た時刻（この 10 秒の分。staffPollBusy） */
  polls: number[];
};
// 形を変えたら名前の数字を上げる（開発中のサーバーに前の形が残っていても、新しく作り直す）
const gm = globalThis as unknown as { __muchuMemV2?: Mem };
function mem(): Mem {
  return (gm.__muchuMemV2 ??= {
    gen: 0,
    raw: null,
    contentAt: 0,
    liveAt: 0,
    allP: null,
    liveP: null,
    setGen: 0,
    sets: new Map(),
    setP: null,
    keyGen: 0,
    keys: null,
    keyP: null,
    hashGen: 0,
    hashes: new Map(),
    hits: new Map(),
    polls: [],
  });
}

/**
 * 従業員の画面の 15 秒ごとの読み直しを数え、この 10 秒にこのサーバーへ 5 回以上来ていれば true。
 * 少ないときは、そのお店の分だけ新しく読む方が安い（2 回）。多いときは、全部の表をまとめて読んで使い回す方が安い（台数が増えても回数が増えない）
 */
export function staffPollBusy() {
  const m = mem();
  const now = Date.now();
  m.polls = m.polls.filter((t) => now - t < STAFF_POLL_READ.content);
  m.polls.push(now);
  return m.polls.length >= 5;
}

/** 読みかけを相乗りできるように置き、終わったら外す */
function share<T>(slot: "allP" | "liveP" | "setP" | "keyP", gen: number, p: Promise<T>): Promise<T> {
  const m = mem() as unknown as Record<string, Shared<unknown> | null>;
  const entry: Shared<T> = { gen, at: Date.now(), p };
  m[slot] = entry as Shared<unknown>;
  p.finally(() => {
    if (m[slot] === (entry as Shared<unknown>)) m[slot] = null;
  }).catch(() => {});
  return p;
}

/** 書いたあと。live だけなら当日の値だけ読み直す（中身の表はそのまま使える） */
function dropCache(kind: "all" | "live" = "all") {
  const m = mem();
  m.gen++;
  if (kind === "all") m.raw = null;
  else m.liveAt = 0;
}

/** お客さん側の使い回しの古さ（表示の時期の設定をまだ読んでいなければ、いちばん短い「開催中」の値） */
export function publicRead(now = Date.now()): ReadWindow {
  const p = mem().sets.get("phase");
  const t = LIVE_TIMING[p ? phaseOf(now, parsePhaseMode(p.v, now)) : "during"];
  return { content: t.contentMs, live: t.liveMs, set: t.liveMs };
}

/** 従業員（署名が合って期限内のクッキー muchu_staff がある人。auth.ts の COOKIE と同じ名前）が見ているか。Redis は使わない */
const STAFF_COOKIE = "muchu_staff";
async function staffViewer(): Promise<boolean> {
  try {
    const { cookies } = await import("next/headers");
    const v = (await cookies()).get(STAFF_COOKIE)?.value;
    if (!v) return false;
    // auth.ts は store.ts を読みこむので、ここで読む（読みこみの輪にしない）
    const { isStaffCookie } = await import("./auth");
    return isStaffCookie(v);
  } catch (e) {
    // Next の合図（「このページは毎回作る」など）は飲みこまずに上へ。ページや API の外で呼ばれたときは、お客さんとして扱う
    unstable_rethrow(e);
    return false;
  }
}

async function windowOf(opts: ReadOpts): Promise<ReadWindow> {
  if (opts.fresh) return FRESH_READ;
  if (opts.read) return opts.read;
  return (await staffViewer()) ? STAFF_PAGE_READ : publicRead();
}

/** v0.16.0 の「校内ラジオを 1 度だけ隠す」を、このサーバーの中でもう試したか（読み込みのたびに Redis を呼ばないように） */
let radioFixTried = false;

/** お店の JSON を「非表示」にしたもの（読めなければ null）。もう非表示なら、そのまま */
function hiddenShopJson(raw: string): { json: string; changed: boolean; name: string } | null {
  try {
    const o = JSON.parse(raw) as Record<string, unknown> | null;
    if (!o || typeof o !== "object") return null;
    const name = typeof o.name === "string" ? o.name : RADIO_SHOP;
    if (o.hidden === true) return { json: raw, changed: false, name };
    return { json: JSON.stringify({ ...o, hidden: true, updatedAt: Date.now() }), changed: true, name };
  } catch {
    return null;
  }
}

/** v0.17.0 の「外のお店を会場マップの場所へ移す」を、このサーバーの中でもう試したか */
let outFixTried = false;
/** 前の仮の外のピン → 会場マップの場所（体験は知育館の前から大食堂の中に変わった＝2026-11-20 ユーザー） */
const OUT_MOVES: Record<string, string> = { "tent-food": "out-yakisoba", "tent-chiiku": "out-shokudo" };

/**
 * 外のお店を会場マップの場所へ移す直し（無ければ null）：仮のピン 2 つにあったお店は会場マップの場所へ（体験は大食堂。
 * 「知育館のそば」と書いた場所の補足は合わなくなるので消す）、場所が未定のエンカレ茶屋は茶屋の枠へ。仮のピンは消す
 */
function outPlacesFix(r: Raw): { shop: Record<string, string>; dropPlaces: string[]; log: LogEntry[] } | null {
  const at = Date.now();
  const mapPlaces = layoutPlaces(layoutOf(r));
  const nameOf = (id: string) => mapPlaces.find((p) => p.id === id)?.name ?? id;
  const shop: Record<string, string> = {};
  const log: LogEntry[] = [];
  for (const [sid, v] of Object.entries(r.shop)) {
    const o = objOf(v);
    if (!o) continue;
    const from = str(o.placeId);
    const to = OUT_MOVES[from] ?? (sid === "chaya" && (!from || !r.place[from]) ? "out-chaya" : "");
    if (!to) continue;
    const name = str(o.name) || sid;
    const note = str(o.placeNote);
    const dropNote = from === "tent-chiiku" && note.includes("知育館");
    shop[sid] = JSON.stringify({ ...o, placeId: to, ...(dropNote ? { placeNote: "" } : {}), updatedAt: at });
    const after = `${nameOf(to)}（会場マップの場所。サイトの更新 v0.17.0 で）`;
    log.push({ at, by: "admin", shop: sid, shopName: name, field: "場所", before: from ? str(objOf(r.place[from] ?? "")?.name) || from : "未定", after });
    if (dropNote) log.push({ at, by: "admin", shop: sid, shopName: name, field: "場所の補足", before: note, after: "" });
  }
  const dropPlaces = Object.keys(OUT_MOVES).filter((id) => r.place[id]);
  return Object.keys(shop).length || dropPlaces.length ? { shop, dropPlaces, log } : null;
}

/** v0.18.0 の「2 階の部屋の四角を新しい見取り図に合わせる」を、このサーバーの中でもう試したか */
let f2FixTried = false;
/**
 * 知育館 2 階の見取り図の直し（2026-11-20 ユーザーの修正版）：202 の下の帯は廊下に、倉庫が無くなって玄関ホールが右へ広がった。
 * 部屋の四角（202・玄関ホール）が、はじめの位置（FLOOR_SEED の前の値）のままなら、新しい形に合わせる。実行委員が動かした四角はそのまま
 */
const F2_FIX: Record<string, { from: number[]; to: number[] }> = {
  "f2-202": { from: [27.3, 64.1, 12.6, 34.2], to: [27.3, 58.8, 12.6, 23.6] },
  "f2-genkan": { from: [62.8, 64.1, 29.3, 34.2], to: [66.5, 64.1, 36.7, 34.2] },
};
function f2PlanFix(r: Raw): Record<string, string> | null {
  const out: Record<string, string> = {};
  for (const [id, f] of Object.entries(F2_FIX)) {
    const o = objOf(r.place[id] ?? "");
    if (!o || ![o.x, o.y, o.w, o.h].every((v, i) => v === f.from[i])) continue;
    const [x, y, w, h] = f.to;
    out[id] = JSON.stringify({ ...o, x, y, w, h });
  }
  return Object.keys(out).length ? out : null;
}

/** v0.21.0 の「11/20 の打ち合わせの内容を入れる」を、このサーバーの中でもう試したか */
let minutesFixTried = false;
/** 打ち合わせで決まった値段（v0.21.0） */
const YAKISOBA_PRICE = { from: "400円前後（予定）", to: "300円" };
const CHAYA_SET = { name: "セット（団子 1 個・飲み物・金平糖）", price: "300円" };
/** 打ち合わせで決まった時間（お店の「当日の流れ」が空のときだけ入れる） */
const MINUTES_SCHEDULE: Record<string, { time: string; text: string }[]> = {
  shateki: [{ time: "10:00〜12:00", text: "射的・くじ引き" }],
  oshibana: [{ time: "12:00〜14:00", text: "押し花しおりづくり" }],
};
/** 地域のつくり手を紹介の場所（会場マップのテント。outside-plan.ts） */
const CHIIKI_PLACE = "out-tent-craft";

/**
 * 11/20 の打ち合わせ（ユーザーが貼った議事録）で決まったことを、お店の情報に 1 度だけ入れる直し（無ければ null）。
 * お店の人・実行委員がもう書きかえた欄はさわらない（はじめの値か空のときだけ）：
 * 焼きそばの値段（400円前後（予定）→ 300円）、エンカレ茶屋のメニューの先頭にセット 300 円（セットがまだ無ければ。ほかの品はそのまま）、
 * 地域のつくり手を紹介の場所（未定なら、クラフトセンターの下のテント）、射的 10:00〜12:00・押し花しおりづくり 12:00〜14:00（当日の流れが空なら）
 */
function minutesFix(r: Raw): { shop: Record<string, string>; log: LogEntry[] } | null {
  const at = Date.now();
  const why = "（11/20 の打ち合わせ。サイトの更新 v0.21.0 で）";
  const shop: Record<string, string> = {};
  const log: LogEntry[] = [];
  const edit = (sid: string, f: (o: Record<string, unknown>, add: (field: string, before: string, after: string) => void) => Record<string, unknown> | null) => {
    const o = objOf(r.shop[sid] ?? "");
    if (!o) return;
    const shopName = str(o.name) || sid;
    const next = f(o, (field, before, after) => log.push({ at, by: "admin", shop: sid, shopName, field, before, after: `${after}${why}` }));
    if (next) shop[sid] = JSON.stringify({ ...o, ...next, updatedAt: at });
  };
  const menuOf = (o: Record<string, unknown>) => (Array.isArray(o.menu) ? (o.menu as unknown[]) : []).filter((m): m is Record<string, unknown> => !!m && typeof m === "object");

  edit("yakisoba", (o, add) => {
    const menu = menuOf(o);
    const i = menu.findIndex((m) => str(m.name) === "焼きそば" && str(m.price) === YAKISOBA_PRICE.from);
    if (i < 0) return null;
    add("メニュー（焼きそばの値段）", YAKISOBA_PRICE.from, YAKISOBA_PRICE.to);
    return { menu: menu.map((m, j) => (j === i ? { ...m, price: YAKISOBA_PRICE.to } : m)) };
  });
  edit("chaya", (o, add) => {
    const menu = menuOf(o);
    if (menu.some((m) => str(m.name).includes("セット"))) return null;
    const ids = new Set(menu.map((m) => str(m.id)));
    let id = "set";
    for (let n = 2; ids.has(id); n++) id = `set-${n}`;
    add("メニュー", "", `${CHAYA_SET.name} ${CHAYA_SET.price} を先頭に追加`);
    return { menu: [{ id, name: CHAYA_SET.name, price: CHAYA_SET.price, note: "", stock: "on" }, ...menu] };
  });
  edit("chiiki", (o, add) => {
    if (str(o.placeId)) return null;
    add("場所", "未定", "テント（クラフトセンターの下）");
    return { placeId: CHIIKI_PLACE };
  });
  for (const [sid, rows] of Object.entries(MINUTES_SCHEDULE)) {
    edit(sid, (o, add) => {
      if (Array.isArray(o.schedule) && o.schedule.length) return null;
      add("当日の流れ", "", rows.map((x) => `${x.time} ${x.text}`).join("、"));
      return { schedule: rows };
    });
  }
  return Object.keys(shop).length ? { shop, log } : null;
}

/** Redis から全部の表を読む（はじめのデータがまだなら入れる） */
async function loadRaw(): Promise<Raw> {
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
  // v0.11.0 から：フロア（建物の中）の見取り図。まだ 1 つも無ければ、はじめの 2〜4 階を 1 度だけ入れる（そのあと全部消しても入れ直さない）
  if (!Object.keys(r.area).length) {
    if (storeReady()) {
      if (await b.seedOnce("seeded:areas", seedFloors())) r = await b.readAll();
    } else {
      const f = seedFloors();
      r = { ...r, area: f.area!, place: { ...r.place, ...f.place } };
    }
  }
  // v0.16.0（2026-11-17）：校内ラジオ（お店・出し物の radio）を 1 度だけ「お客さんの画面に出さない」にする（ユーザーの希望）。
  // ラジオのページ・ホームの入口・「放送中」の札も、これに合わせて消える（radio-shop.ts）。目印 muchu:fix:radio-hidden が立つので、
  // あとで実行委員が［お客さんの画面に出す］を押せば、もう隠さない。変更の記録にも残す
  if (!radioFixTried && storeReady() && r.shop[RADIO_SHOP]) {
    radioFixTried = true;
    const h = hiddenShopJson(r.shop[RADIO_SHOP]);
    if (h && (await b.seedOnce("fix:radio-hidden", { shop: { [RADIO_SHOP]: h.json } })) && h.changed) {
      r = await b.readAll();
      try {
        await addLog([{ at: Date.now(), by: "admin", shop: RADIO_SHOP, shopName: h.name, field: "お客さんの画面", before: "表示中", after: "非表示（サイトの更新 v0.16.0 で）" }]);
      } catch (e) {
        console.error("変更の記録に失敗", e);
      }
    }
  }
  // v0.17.0（2026-11-20）：外の場所を会場マップの枠に（outside-plan.ts の OUT_PLACES）。前の仮の外のピンにあったお店を
  // 会場マップの場所へ 1 度だけ移し、仮のピンを消す（outPlacesFix）。目印 muchu:fix:out-places があるので、そのあと実行委員が
  // お店の場所を変えれば、それに従う。変更の記録にも残す
  if (!outFixTried && storeReady()) {
    outFixTried = true;
    const fix = outPlacesFix(r);
    if (fix && (await b.flagOnce("fix:out-places"))) {
      if (Object.keys(fix.shop).length) await b.hset("shop", fix.shop);
      if (fix.dropPlaces.length) await b.hdel("place", fix.dropPlaces);
      r = await b.readAll();
      try {
        if (fix.log.length) await addLog(fix.log);
      } catch (e) {
        console.error("変更の記録に失敗", e);
      }
    }
  }
  // v0.18.0（2026-11-20）：知育館 2 階の見取り図をユーザーの修正版に（floor-plans.ts）。部屋の四角を 1 度だけ合わせる（f2PlanFix。目印 muchu:fix:f2-plan）
  if (!f2FixTried && storeReady()) {
    f2FixTried = true;
    const fix = f2PlanFix(r);
    if (fix && (await b.flagOnce("fix:f2-plan"))) {
      await b.hset("place", fix);
      r = await b.readAll();
    }
  }
  // v0.21.0（2026-11-24）：11/20 の打ち合わせで決まった値段・場所・時間を、お店の情報に 1 度だけ入れる（minutesFix。目印 muchu:fix:minutes-1120）。
  // はじめの値・空の欄だけ直すので、お店の人・実行委員が書いた所は残る。そのあとは実行委員・お店の人の変更に従う。変更の記録にも残す
  if (!minutesFixTried && storeReady()) {
    minutesFixTried = true;
    const fix = minutesFix(r);
    if (fix && (await b.flagOnce("fix:minutes-1120"))) {
      await b.hset("shop", fix.shop);
      r = await b.readAll();
      try {
        if (fix.log.length) await addLog(fix.log);
      } catch (e) {
        console.error("変更の記録に失敗", e);
      }
    }
  }
  return r;
}

/** 全部の表を読む。fresh でなければ、読みかけに相乗りする */
function readAll(fresh: boolean): Promise<Raw> {
  const m = mem();
  if (!fresh && joinable(m.allP, m.gen)) return m.allP.p;
  const gen = m.gen;
  const at = Date.now();
  return share(
    "allP",
    gen,
    loadRaw().then((r) => {
      if (gen === m.gen) {
        m.raw = r;
        m.contentAt = at;
        m.liveAt = at;
      }
      return r;
    }),
  );
}

/** 当日の値と全体のお知らせだけ読む（2 回分）。全部の読みかけがあれば、そちらに相乗りする */
function readLive(fresh: boolean): Promise<Pick<Raw, "live" | "news">> {
  const m = mem();
  if (!fresh) {
    if (joinable(m.allP, m.gen)) return m.allP.p.then((r) => ({ live: r.live, news: r.news }));
    if (joinable(m.liveP, m.gen)) return m.liveP.p;
  }
  const gen = m.gen;
  const at = Date.now();
  return share(
    "liveP",
    gen,
    backend()
      .readTables(LIVE_TABLES)
      .then((t) => {
        const l = { live: t.live ?? {}, news: t.news ?? {} };
        if (gen === m.gen && m.raw) {
          m.raw = { ...m.raw, ...l };
          m.liveAt = at;
        }
        return l;
      }),
  );
}

async function raw(w: ReadWindow): Promise<Raw> {
  const m = mem();
  const now = Date.now();
  const base = m.raw;
  const contentOk = !!base && w.content > 0 && now - m.contentAt < w.content;
  const liveOk = !!base && w.live > 0 && now - m.liveAt < w.live;
  if (base && contentOk && liveOk) return base;
  if (base && contentOk) return { ...base, ...(await readLive(w.live === 0)) };
  return readAll(w.content === 0 || w.live === 0);
}

/* ───── 当日よく変わる物（営業の状態・お知らせ・品物の残り）は muchu:live に 1 つずつ ───── */
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

/** 外の会場マップの配置（保存が無い・読めなければ、はじめの配置） */
function layoutOf(r: Raw): OutLayout {
  return parseLayout(r.omap?.layout) ?? DEFAULT_LAYOUT;
}

function siteData(r: Raw): SiteData {
  const live = liveIndex(r.live);
  const outLayout = layoutOf(r);
  return {
    outLayout,
    depts: parseTable(r.dept, asDept).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, "ja") || byId(a, b)),
    shops: parseTable(r.shop, asShop)
      .map((s) => withLive(s, live.get(s.id)))
      .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, "ja") || byId(a, b)),
    // 会場マップの場所（外の配置の枠から作る。outside-plan.ts の layoutPlaces）も足す（「out-」で始まる保存した場所は使わない）。
    // 同じ名前のピン（各階のトイレなど）は、外 → フロアの id の順（f2・f3・f4）
    places: [...parseTable(r.place, asPlace).filter((p) => !isMapPlaceId(p.id)), ...layoutPlaces(outLayout)].sort(
      (a, b) => a.name.localeCompare(b.name, "ja", { numeric: true }) || (a.area ?? "").localeCompare(b.area ?? "", "ja", { numeric: true }) || byId(a, b),
    ),
    areas: parseTable(r.area, asArea).sort(
      (a, b) => a.order - b.order || a.building.localeCompare(b.building, "ja") || a.floor.localeCompare(b.floor, "ja", { numeric: true }) || byId(a, b),
    ),
    news: sortNews(parseTable(r.news, asNews)),
  };
}

/** 全部を読む。fresh なら Redis から新しく（実行委員・お店の人が書いたあと・編集の画面）。ほかは使い回す（上の「読みの使い回し」） */
export async function loadAll(opts: ReadOpts = {}): Promise<SiteData> {
  return siteData(await raw(await windowOf(opts)));
}

/** 全体のお知らせだけ（実行委員の「全体のお知らせ」の画面の読み直し用。fresh なら 1 回の読み込み） */
export async function loadNews(opts: ReadOpts = {}): Promise<News[]> {
  if (opts.fresh) return sortNews(parseTable(await backend().hgetall("news"), asNews));
  return sortNews(parseTable((await raw(await windowOf(opts))).news, asNews));
}

/** お店を 1 つ読む。fresh なら、そのお店の JSON と当日の値だけを読む（全部の表を読むより安い） */
export async function getShop(id: string, opts: ReadOpts = {}) {
  if (opts.fresh) {
    const [v, live] = await Promise.all([backend().hget("shop", id), backend().hgetall("live")]);
    const shop = asShop(id, v);
    return shop ? withLive(shop, liveIndex(live).get(id)) : null;
  }
  const r = await raw(await windowOf(opts));
  const shop = asShop(id, r.shop[id]);
  return shop ? withLive(shop, liveIndex(r.live).get(id)) : null;
}

function guard() {
  if (!storeReady()) throw new StoreNotReady();
}

/**
 * お店の中身（名前・紹介・メニューなど）を保存する。営業の状態・お知らせ・品物の残りは saveLive で。
 * メニューから消えた品物の「残り」は消しておく（同じ id の品物をあとで足したとき、古い売り切れが付かないように）。
 * 保存した中身（updatedAt つき）を返す
 */
export async function saveShop(shop: Shop): Promise<Shop> {
  guard();
  const saved = { ...shop, updatedAt: Date.now() };
  await backend().hset("shop", { [shop.id]: JSON.stringify(saved) });
  const live = await backend().hgetall("live");
  const keep = new Set(shop.menu.map((m) => `${shop.id}:s:${m.id}`));
  const stale = Object.keys(live).filter((k) => k.startsWith(`${shop.id}:s:`) && !keep.has(k));
  if (stale.length) await backend().hdel("live", stale);
  dropCache();
  return saved;
}

export type LivePatch = { state?: ShopState; notice?: string; stock?: Record<string, Stock> };

/** 当日よく変わる物を、お店ごとにまとめて 1 回で書く（ほかの欄・ほかの品物には触らない）。書いた時刻を返す */
export async function saveLive(changes: Record<string, LivePatch>): Promise<number> {
  guard();
  const now = Date.now();
  const at = String(now);
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
  dropCache("live");
  return now;
}

export async function deleteShop(id: string) {
  guard();
  const live = await backend().hgetall("live");
  await backend().hdel("shop", [id]);
  await backend().hdel("key", [id]);
  await backend().hdel("live", Object.keys(live).filter((k) => k.startsWith(`${id}:`)));
  dropCache();
  dropKeys();
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
/**
 * ピンを消す。そのピンを場所にしていたお店は「未定」に戻す（同じ名前のピンをあとで足したとき、勝手につながらないように）。
 * 未定に戻したお店の id を返す
 */
export async function deletePlace(id: string): Promise<string[]> {
  guard();
  await backend().hdel("place", [id]);
  const shops = await backend().hgetall("shop");
  const values: Record<string, string> = {};
  for (const [sid, v] of Object.entries(shops)) {
    const o = objOf(v);
    if (o && o.placeId === id) values[sid] = JSON.stringify({ ...o, placeId: "", updatedAt: Date.now() });
  }
  if (Object.keys(values).length) await backend().hset("shop", values);
  dropCache();
  return Object.keys(values);
}
/**
 * 外の会場マップの配置を保存する（v0.22.0）。配置から消えた場所（out-…）を場所にしていたお店は「未定」に戻し、そのお店の id を返す
 * （消えた場所の id は、呼ぶ側が前の配置と比べて渡す）
 */
export async function saveOutLayout(layout: OutLayout, dropped: string[]): Promise<string[]> {
  guard();
  await backend().hset("omap", { layout: JSON.stringify(layout) });
  const values: Record<string, string> = {};
  if (dropped.length) {
    const gone = new Set(dropped);
    const shops = await backend().hgetall("shop");
    for (const [sid, v] of Object.entries(shops)) {
      const o = objOf(v);
      if (o && typeof o.placeId === "string" && gone.has(o.placeId)) values[sid] = JSON.stringify({ ...o, placeId: "", updatedAt: Date.now() });
    }
    if (Object.keys(values).length) await backend().hset("shop", values);
  }
  dropCache();
  return Object.keys(values);
}

export async function saveArea(a: Area) {
  guard();
  await backend().hset("area", { [a.id]: JSON.stringify(a) });
  dropCache();
}
export async function deleteArea(id: string) {
  guard();
  await backend().hdel("area", [id]);
  dropCache();
}
export async function saveNews(n: News) {
  guard();
  await backend().hset("news", { [n.id]: JSON.stringify(n) });
  dropCache("live");
}
export async function deleteNews(id: string) {
  guard();
  await backend().hdel("news", [id]);
  dropCache("live");
}

/* ───── お店の編集用のかぎ ───── */
/** ログインの確かめで使い回す古さ（かぎを作り直すと、ほかの台では長くてこの時間だけ前のかぎのログインが通る） */
const KEY_MS = 15_000;

function dropKeys() {
  const m = mem();
  m.keys = null;
  m.keyGen++;
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
  dropKeys();
  return k;
}
export async function rotateShopKey(id: string) {
  guard();
  const k = newKey();
  await backend().hset("key", { [id]: k });
  dropCache();
  dropKeys();
  return k;
}
/** かぎの照合用（いつも最新を読む。QR で入るときなど。そのお店の 1 件だけ読む） */
export async function storedShopKey(id: string): Promise<string | null> {
  return backend().hget("key", id);
}
/**
 * ログイン中かの確かめ用（全部のお店のかぎを 1 回で読み、15 秒使い回す）。
 * 合わないとき・無いときは auth.ts が storedShopKey で読み直す（作ったばかりのお店・作り直したばかりのかぎでも入れる）
 */
export async function cachedShopKey(id: string): Promise<string | null> {
  const m = mem();
  if (m.keys && Date.now() - m.keys.at < KEY_MS) return m.keys.t[id] ?? null;
  if (!joinable(m.keyP, m.keyGen)) {
    const gen = m.keyGen;
    const at = Date.now();
    share(
      "keyP",
      gen,
      backend()
        .hgetall("key")
        .then((t) => {
          if (gen === m.keyGen) m.keys = { at, t };
          return t;
        }),
    );
  }
  return (await m.keyP!.p)[id] ?? null;
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

/* ───── 回数の上限 ───── */
/** 回数の上限（window 秒のあいだに limit 回まで。全部のサーバーで数える＝Upstash を 2 回使う）。数えて、超えたら false */
export async function allow(bucket: string, limit: number, windowSec: number) {
  const n = await backend().incr(bucket, windowSec);
  return n <= limit;
}
/** まちがいの回数がもう上限に来ているか（数えない。まちがえたときだけ allow で数える） */
export async function blocked(bucket: string, limit: number) {
  return (await backend().count(bucket)) >= limit;
}
/**
 * このサーバーの中だけで数える回数の上限（Upstash を使わない）。数えて、超えたら false。
 * 連打を Redis の前で止めるために使う（台が分かれると数は分かれるので、本当の上限は allow で）
 */
export function allowHere(bucket: string, limit: number, windowSec: number) {
  const hits = mem().hits;
  const now = Date.now();
  if (hits.size > 5000) for (const [k, v] of hits) if (v.until <= now) hits.delete(k);
  const c = hits.get(bucket);
  if (!c || c.until <= now) {
    hits.set(bucket, { n: 1, until: now + windowSec * 1000 });
    return 1 <= limit;
  }
  c.n++;
  return c.n <= limit;
}
/** このサーバーの中で数えた回数が、もう上限に来ているか（数えない） */
export function blockedHere(bucket: string, limit: number) {
  const c = mem().hits.get(bucket);
  return !!c && c.until > Date.now() && c.n >= limit;
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

/** アンケートを受け付けているか（はじめは受け付ける）。お客さん側では設定を使い回す */
export async function surveyOpen(opts: ReadOpts = {}) {
  return (await getSetting("surveyOpen", opts)) !== "0";
}

export async function setSurveyOpen(open: boolean) {
  await setSetting("surveyOpen", open ? "1" : "0");
}

/* ───── 文字の設定 ───── */
/** お客さん側に毎回配る運営の設定（全体の帯・表示の時期・アワード・アンケートの受付・ラジオ）。お客さん側では、まとめて 1 回で読んで使い回す */
export const PUBLIC_SETTING_KEYS = ["alert", "phase", "award", "surveyOpen", "radio"] as const;
const PUBLIC_SET = new Set<string>(PUBLIC_SETTING_KEYS);

async function settingsNow(keys: string[]) {
  const m = mem();
  const gen = m.setGen;
  const at = Date.now();
  const vals = await backend().getMany(keys);
  if (gen === m.setGen) keys.forEach((k, i) => m.sets.set(k, { v: vals[i], at }));
  return vals;
}

async function readSettings(keys: string[], maxAge: number): Promise<(string | null)[]> {
  if (maxAge > 0) {
    const m = mem();
    const hit = () => {
      const now = Date.now();
      const hs = keys.map((k) => m.sets.get(k));
      return hs.every((h) => h && now - h.at < maxAge) ? hs.map((h) => h!.v) : null;
    };
    const first = hit();
    if (first) return first;
    if (keys.every((k) => PUBLIC_SET.has(k))) {
      // お客さん側の設定は、5 つまとめて 1 回で読む（読みかけがあれば相乗り）
      if (!joinable(m.setP, m.setGen)) share("setP", m.setGen, settingsNow([...PUBLIC_SETTING_KEYS]).then(() => undefined));
      await m.setP!.p;
      const second = hit();
      if (second) return second;
    }
  }
  return settingsNow(keys);
}

/**
 * 手元（next dev）だけ：クッキー dev-phase（before・during・after）を付けた端末だけ、表示の時期をその値にして見せる。
 * 何人かで同時に画面を確かめるとき、みんなの「表示の時期」を切り替えずに済むように。本番では読まない
 */
async function devPhase(): Promise<string | null> {
  if (process.env.NODE_ENV === "production") return null;
  try {
    const { cookies } = await import("next/headers");
    return (await cookies()).get("dev-phase")?.value ?? null;
  } catch {
    return null;
  }
}
/** 文字の設定を読む（なければ null）。お客さん側では使い回す（従業員はいつも新しく） */
export async function getSetting(key: string, opts: ReadOpts = {}) {
  return (await getSettings([key], opts))[0];
}
/** 文字の設定をまとめて読む（1 回で読む。並びは keys と同じ）。お客さん側では使い回す（従業員はいつも新しく） */
export async function getSettings(keys: string[], opts: ReadOpts = {}) {
  const vals = await readSettings(keys, (await windowOf(opts)).set);
  // 手元の dev-phase の上書きは、使い回しのあとに（使い回しの中には入れない）
  const i = keys.indexOf("phase");
  if (i >= 0) {
    const d = await devPhase();
    if (d) vals[i] = d;
  }
  return vals;
}
/** 文字の設定を書く（JSON を入れてもよい） */
export async function setSetting(key: string, value: string) {
  guard();
  await backend().setStr(key, value);
  const m = mem();
  m.sets.delete(key);
  m.setGen++;
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

/**
 * ハッシュ（id → 文字）を読む・書く・消す。チェックリスト・連絡を読んだ印など、1 件ずつ別々に変わる物に使う。
 * maxAge（ミリ秒）を渡すと、同じサーバーの中でその古さまで使い回す（従業員の画面の 15 秒ごとの読み直し用）
 */
export async function readHash(name: string, opts: { maxAge?: number } = {}) {
  const m = mem();
  const h = m.hashes.get(name);
  if (opts.maxAge && h && Date.now() - h.at < opts.maxAge) return { ...h.t };
  const gen = m.hashGen;
  const at = Date.now();
  const t = await backend().hgetall(name);
  if (gen === m.hashGen) m.hashes.set(name, { at, t });
  return { ...t };
}
export async function readHashOne(name: string, id: string) {
  return backend().hget(name, id);
}
export async function writeHash(name: string, values: Record<string, string>) {
  guard();
  await backend().hset(name, values);
  const m = mem();
  m.hashes.delete(name);
  m.hashGen++;
}
export async function removeHash(name: string, ids: string[]) {
  guard();
  await backend().hdel(name, ids);
  const m = mem();
  m.hashes.delete(name);
  m.hashGen++;
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
