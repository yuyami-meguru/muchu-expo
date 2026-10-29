import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { storedShopKey } from "./store";

/*
 * 従業員側のログイン。アカウントは作らない。
 *  - 実行委員・先生：合言葉（環境変数 ADMIN_PASSPHRASE）→ すべてのお店・地図・お知らせを編集できる
 *  - お店の人：お店ごとの QR（中に編集用のかぎ）→ そのお店の売り切れ・状態・お知らせだけ
 * どちらも、署名つきの Cookie（muchu_staff）に「だれか」を入れる。お店のかぎを作り直すと、そのお店の Cookie は使えなくなる。
 */

export type Session = { role: "admin"; exp: number } | { role: "shop"; shop: string; kfp: string; exp: number };

export const COOKIE = "muchu_staff";
const ADMIN_HOURS = 12;
const SHOP_HOURS = 72;

/** 合言葉。手元（next dev）で設定がなければ dev-pass。本番は 12 文字より短いと使わない（当てられにくくするため） */
export function adminPassphrase(): string | null {
  const p = process.env.ADMIN_PASSPHRASE;
  if (process.env.NODE_ENV !== "production") return p || "dev-pass";
  return p && p.length >= 12 ? p : null;
}

function secret() {
  const s = process.env.STAFF_SESSION_SECRET;
  if (s) return s;
  const p = adminPassphrase();
  // 合言葉が無いとき（本番の設定前）は、だれもログインできない値にする
  return createHash("sha256").update(`muchu-session:${p ?? createHash("sha256").update(String(Math.random())).digest("hex")}`).digest("hex");
}

const sha = (s: string) => createHash("sha256").update(s).digest();

/** 長さがちがっても時間が変わらない比べ方 */
export function sameText(a: string, b: string) {
  return timingSafeEqual(sha(a), sha(b));
}

/** かぎの指紋（Cookie に入れる。かぎそのものは入れない） */
export function keyPrint(key: string) {
  return createHash("sha256").update(`kfp:${key}`).digest("base64url").slice(0, 12);
}

function sign(body: string) {
  return createHmac("sha256", secret()).update(body).digest("base64url");
}

export function encodeSession(s: Session) {
  const body = Buffer.from(JSON.stringify(s)).toString("base64url");
  return `${body}.${sign(body)}`;
}

function decodeSession(v: string | undefined): Session | null {
  if (!v) return null;
  const [body, mac] = v.split(".");
  if (!body || !mac || !sameText(sign(body), mac)) return null;
  try {
    const s = JSON.parse(Buffer.from(body, "base64url").toString()) as Session;
    if (!s.exp || s.exp < Date.now()) return null;
    return s;
  } catch {
    return null;
  }
}

export function newSession(role: "admin"): Session;
export function newSession(role: "shop", shop: string, key: string): Session;
export function newSession(role: "admin" | "shop", shop?: string, key?: string): Session {
  if (role === "admin") return { role, exp: Date.now() + ADMIN_HOURS * 3600e3 };
  return { role, shop: shop!, kfp: keyPrint(key!), exp: Date.now() + SHOP_HOURS * 3600e3 };
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

/** いまログインしている人（いなければ null）。お店の人は、かぎが作り直されていないかも確かめる */
export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  const s = decodeSession(jar.get(COOKIE)?.value);
  if (!s) return null;
  if (s.role === "shop") {
    const k = await storedShopKey(s.shop);
    if (!k || keyPrint(k) !== s.kfp) return null;
  }
  return s;
}

/** このお店を編集してよいか */
export function canEditShop(s: Session | null, shopId: string) {
  return !!s && (s.role === "admin" || s.shop === shopId);
}
