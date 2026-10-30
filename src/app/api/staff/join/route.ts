import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { COOKIE, cookieOptions, encodeSession, newSession, sameText, sessionReady } from "@/lib/auth";
import { clientIp, fail, guarded, ok, readBody, zId } from "@/lib/api";
import { allow, blocked, storedShopKey } from "@/lib/store";

// お店の QR（/join#s=お店&k=かぎ）を読み取った人を、そのお店の人としてログインさせる。
// 使えない QR の読み取りは「つなぎ先（IP）×お店」ごとに 10 分 60 回まで（数えるのは失敗だけ）。学校の Wi-Fi では全員が同じ IP になるので、お店ごとに分ける（かぎは 18 バイトの乱数で、当てずっぽうでは当たらない）
const LIMIT = process.env.NODE_ENV === "production" ? 60 : 200;
export async function POST(req: NextRequest) {
  return guarded(async () => {
    const b = await readBody(req, z.object({ shop: zId, key: z.string().min(10).max(100) }));
    if ("error" in b) return b.error;
    if (!sessionReady()) return fail(503, "まだログインの準備ができていません。実行委員（サイト担当の AVERIX）に知らせてください");
    const bucket = `join:${clientIp(req)}:${b.data.shop}`;
    if (await blocked(bucket, LIMIT)) return fail(429, "使えない QR の読み取りが続いたので、少し止めています。10 分ほど待ってから、新しい QR を読み取ってください");
    const k = await storedShopKey(b.data.shop);
    if (!k || !sameText(b.data.key, k)) {
      await allow(bucket, LIMIT, 600);
      return fail(401, "この QR は使えません（新しい QR に作り直されています）。実行委員から新しい QR をもらってください");
    }
    const s = newSession("shop", b.data.shop, k);
    (await cookies()).set(COOKIE, encodeSession(s), cookieOptions(s));
    return ok({ role: "shop", shop: b.data.shop });
  });
}
