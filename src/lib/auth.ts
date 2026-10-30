import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { cachedShopKey, storedShopKey } from "./store";

/*
 * 従業員側のログイン。アカウントは作らない。
 *  - 実行委員・先生：合言葉（環境変数 ADMIN_PASSPHRASE）→ すべてのお店・地図・お知らせを編集できる
 *  - お店の人：お店ごとの QR（中に編集用のかぎ）→ そのお店の売り切れ・状態・お知らせだけ
 * どちらも、署名つきの Cookie（muchu_staff）に「だれか」を入れる。お店のかぎを作り直すと、そのお店の Cookie は使えなくなる。
 */

export type Session = { role: "admin"; exp: number } | { role: "shop"; shop: string; kfp: string; exp: number };

export const COOKIE = "muchu_staff";
/** ログインが切れた・していないとき（401）の文。だれが読んでも分かるように、両方の入り直し方を書く */
export const LOGIN_EXPIRED = "ログインが切れました。お店の人はお店の QR を、実行委員は合言葉で入り直してください";
/** 実行委員だけの操作を、お店の人が押したとき（403） */
export const ADMIN_ONLY = "実行委員の合言葉でログインしてください";

const ADMIN_HOURS = 12;
const SHOP_HOURS = 72;
/** お店の人のログインは、準備のあいだに入っても当日まで切れないよう、少なくとも開催日の翌日 0:00（日本時間）まで続ける */
const SHOP_AT_LEAST_UNTIL = Date.parse("2026-11-29T00:00:00+09:00");
/** 実行委員：前日（11/27）と当日に入ったときは、当日の 18:00 まで続ける（前の夜に入っても、当日の朝に切れない） */
const ADMIN_EVENT_FROM = Date.parse("2026-11-27T00:00:00+09:00");
const ADMIN_EVENT_UNTIL = Date.parse("2026-11-28T18:00:00+09:00");

/**
 * 合言葉。手元（next dev）で設定がなければ dev-pass。本番は 12 文字より短いと使わない（当てられにくくするため）。
 * 前後の空白は取る（Vercel に空白ごと入れても、入れた人と同じ合言葉になるように。入力の側も trim している）
 */
export function adminPassphrase(): string | null {
  const p = process.env.ADMIN_PASSPHRASE?.trim();
  if (process.env.NODE_ENV !== "production") return p || "dev-pass";
  return p && p.length >= 12 ? p : null;
}

const sha = (s: string) => createHash("sha256").update(s).digest();
const hex = (s: string) => createHash("sha256").update(s).digest("hex");

/**
 * 署名の秘密。いちばん前で署名し、どれかで確かめられれば通す。
 *  - STAFF_SESSION_SECRET があればそれだけ（本番はこれを入れる）
 *  - 無ければ、合言葉と保存先のトークン（KV_REST_API_TOKEN など。サーバーの外には出ない）を混ぜて作る
 *    （合言葉だけから作ると、お店の人が自分の Cookie から合言葉を手元で総当たりできるため）
 *  - v0.11 までの「合言葉だけ」の署名も、確かめるときだけ使う（そのころ入った人を切らないため。お店の人も 11/29 には全部切れる）
 *  - 合言葉が無いとき（本番の設定前）は、だれもログインできない値
 */
function secrets(): string[] {
  const s = process.env.STAFF_SESSION_SECRET;
  if (s) return [s];
  const p = adminPassphrase();
  if (!p) return [randomBytes(32).toString("hex")];
  const salt = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN ?? "";
  const legacy = hex(`muchu-session:${p}`);
  return salt ? [hex(`muchu-session:v2:${p}:${salt}`), legacy] : [legacy];
}

/** ログインの署名に使う秘密が決まっているか（本番で合言葉も STAFF_SESSION_SECRET も無いと、だれもログインできない） */
export function sessionReady() {
  return !!process.env.STAFF_SESSION_SECRET || !!adminPassphrase();
}

/** 長さがちがっても時間が変わらない比べ方 */
export function sameText(a: string, b: string) {
  return timingSafeEqual(sha(a), sha(b));
}

/** かぎの指紋（Cookie に入れる。かぎそのものは入れない） */
export function keyPrint(key: string) {
  return createHash("sha256").update(`kfp:${key}`).digest("base64url").slice(0, 12);
}

const sign = (body: string, secret: string) => createHmac("sha256", secret).update(body).digest("base64url");

export function encodeSession(s: Session) {
  const body = Buffer.from(JSON.stringify(s)).toString("base64url");
  return `${body}.${sign(body, secrets()[0])}`;
}

function decodeSession(v: string | undefined): Session | null {
  if (!v) return null;
  const [body, mac] = v.split(".");
  if (!body || !mac || !secrets().some((k) => sameText(sign(body, k), mac))) return null;
  try {
    const s = JSON.parse(Buffer.from(body, "base64url").toString()) as Session;
    if (!s.exp || s.exp < Date.now()) return null;
    return s;
  } catch {
    return null;
  }
}

/**
 * クッキーの値が、署名の合った期限内のログインか（Redis は使わない。お店のかぎを作り直したかどうかは見ない）。
 * store.ts が「従業員が見ているか」を決めるのに使う（でたらめのクッキーで、お客さん側の読みの使い回しを外されないように）
 */
export function isStaffCookie(v: string | undefined) {
  return !!decodeSession(v);
}

export function newSession(role: "admin"): Session;
export function newSession(role: "shop", shop: string, key: string): Session;
export function newSession(role: "admin" | "shop", shop?: string, key?: string): Session {
  const now = Date.now();
  if (role === "admin") {
    const exp = now + ADMIN_HOURS * 3600e3;
    return { role, exp: now >= ADMIN_EVENT_FROM && now < ADMIN_EVENT_UNTIL ? Math.max(exp, ADMIN_EVENT_UNTIL) : exp };
  }
  return { role, shop: shop!, kfp: keyPrint(key!), exp: Math.max(now + SHOP_HOURS * 3600e3, SHOP_AT_LEAST_UNTIL) };
}

export function cookieOptions(s: Session) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    expires: new Date(s.exp),
  };
}

/**
 * いまログインしている人（いなければ null）。お店の人は、かぎが作り直されていないかも確かめる。
 * かぎは同じサーバーの中で 15 秒使い回す（15 秒ごとの読み直しで Upstash を使いすぎないため）。合わないときは新しく読み直す
 */
export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  const s = decodeSession(jar.get(COOKIE)?.value);
  if (!s) return null;
  if (s.role === "shop") {
    const cached = await cachedShopKey(s.shop);
    if (cached && keyPrint(cached) === s.kfp) return s;
    const k = await storedShopKey(s.shop);
    if (!k || keyPrint(k) !== s.kfp) return null;
  }
  return s;
}

/** このお店を編集してよいか */
export function canEditShop(s: Session | null, shopId: string) {
  return !!s && (s.role === "admin" || s.shop === shopId);
}
