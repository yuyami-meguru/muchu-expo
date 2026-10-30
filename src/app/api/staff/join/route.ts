import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { COOKIE, cookieOptions, encodeSession, newSession, sameText, sessionReady } from "@/lib/auth";
import { clientIp, fail, guarded, ok, readBody, zId } from "@/lib/api";
import { allow, allowHere, blocked, blockedHere, storedShopKey } from "@/lib/store";

// お店の QR（/join#s=お店&k=かぎ）を読み取った人を、そのお店の人としてログインさせる。
// 使えない QR の読み取りは「つなぎ先（IP）×お店」ごとに 10 分 60 回まで（数えるのは失敗だけ）。学校の Wi-Fi では全員が同じ IP になるので、お店ごとに分ける（かぎは 18 バイトの乱数で、当てずっぽうでは当たらない）。
// 止めるかどうかは、まずこのサーバーの中の回数で決める（連打で Upstash を使わない）
const LIMIT = process.env.NODE_ENV === "production" ? 60 : 200;
const UNREADABLE = "QR の中身が読めませんでした。カメラでもう一度、QR 全体が入るように読み取ってください";

export async function POST(req: NextRequest) {
  return guarded(async () => {
    const b = await readBody(req, z.object({ shop: zId, key: z.string().min(10).max(100) }), { invalid: UNREADABLE });
    if ("error" in b) return b.error;
    if (!sessionReady()) return fail(503, "まだログインの準備ができていません。実行委員か、サイト担当（AVERIX）に知らせてください");
    const bucket = `join:${clientIp(req)}:${b.data.shop}`;
    if (blockedHere(bucket, LIMIT) || (await blocked(bucket, LIMIT))) {
      return fail(429, "使えない QR の読み取りが続いたので、少し止めています。10 分ほど待ってから、新しい QR を読み取ってください");
    }
    const k = await storedShopKey(b.data.shop);
    if (!k || !sameText(b.data.key, k)) {
      allowHere(bucket, LIMIT, 600);
      await allow(bucket, LIMIT, 600);
      if (!k) return fail(401, "この QR のお店が見つかりません（お店が消されたのかもしれません）。実行委員に知らせてください");
      return fail(401, "この QR では入れません。新しい QR に作り直されたか、読み取りが欠けたのかもしれません。もう一度読み取っても入れないときは、実行委員から新しい QR をもらってください");
    }
    const s = newSession("shop", b.data.shop, k);
    (await cookies()).set(COOKIE, encodeSession(s), cookieOptions(s));
    return ok({ role: "shop", shop: b.data.shop });
  });
}
