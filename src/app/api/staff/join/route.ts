import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { COOKIE, cookieOptions, encodeSession, newSession, sameText } from "@/lib/auth";
import { clientIp, fail, guarded, ok, readBody, zId } from "@/lib/api";
import { allow, storedShopKey } from "@/lib/store";

// お店の QR（/join#s=お店&k=かぎ）を読み取った人を、そのお店の人としてログインさせる。
// 回数の上限は「つなぎ先（IP）×お店」ごとに 10 分 30 回。学校の Wi-Fi では全員が同じ IP になるので、お店ごとに分ける（かぎは 18 バイトの乱数で、当てずっぽうでは当たらない）
const LIMIT = process.env.NODE_ENV === "production" ? 30 : 200;
export async function POST(req: NextRequest) {
  return guarded(async () => {
    const b = await readBody(req, z.object({ shop: zId, key: z.string().min(10).max(100) }));
    if ("error" in b) return b.error;
    if (!(await allow(`join:${clientIp(req)}:${b.data.shop}`, LIMIT, 600))) return fail(429, "何度もまちがえたので、10 分ほど待ってからためしてください");
    const k = await storedShopKey(b.data.shop);
    if (!k || !sameText(b.data.key, k)) return fail(401, "この QR は使えません。実行委員から新しい QR をもらってください");
    const s = newSession("shop", b.data.shop, k);
    (await cookies()).set(COOKIE, encodeSession(s), cookieOptions(s));
    return ok({ role: "shop", shop: b.data.shop });
  });
}
