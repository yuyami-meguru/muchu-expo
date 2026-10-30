import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { COOKIE, adminPassphrase, cookieOptions, encodeSession, newSession, sameText } from "@/lib/auth";
import { clientIp, fail, guarded, ok, readBody } from "@/lib/api";
import { allow, allowHere, blocked, blockedHere } from "@/lib/store";

// 実行委員・先生の合言葉でログイン。数えるのはまちがえたときだけ（正しく入った人は数えない）。
//  - つなぎ先（IP）ごとに 10 分 300 回まで（学校の Wi-Fi は全員が同じ IP。合言葉は 12 字以上なので、これでも当てずっぽうでは当たらない）
//  - 端末ごと（クッキー muchu_dev の乱数。1 度まちがえると付く）に 10 分 30 回まで（まちがえ続けた 1 台のせいで、同じ Wi-Fi の全員が止まらないように）
// 止めているあいだは、正しい合言葉でも断る（当たったかどうかを教えないため）。止めるかどうかは、まずこのサーバーの中の回数で決め、Upstash を使わない。
// 手元のテストでは 1000 回・200 回
const PROD = process.env.NODE_ENV === "production";
const IP_LIMIT = PROD ? 300 : 1000;
const DEVICE_LIMIT = PROD ? 30 : 200;
const DEVICE_COOKIE = "muchu_dev";
const STOPPED = "合言葉のまちがいが続いたため、10 分ほど止めています。合言葉を確かめてから、もう一度ためしてください";

export async function POST(req: NextRequest) {
  return guarded(async () => {
    const b = await readBody(req, z.object({ pass: z.string().max(200) }));
    if ("error" in b) return b.error;
    const jar = await cookies();
    const dev = /^[A-Za-z0-9_-]{16,40}$/.test(jar.get(DEVICE_COOKIE)?.value ?? "") ? jar.get(DEVICE_COOKIE)!.value : "";
    const ipBucket = `login:${clientIp(req)}`;
    const devBucket = dev ? `login-d:${dev}` : "";
    if (blockedHere(ipBucket, IP_LIMIT) || (devBucket && blockedHere(devBucket, DEVICE_LIMIT))) return fail(429, STOPPED);
    if ((await blocked(ipBucket, IP_LIMIT)) || (devBucket && (await blocked(devBucket, DEVICE_LIMIT)))) return fail(429, STOPPED);
    const pass = adminPassphrase();
    if (!pass) return fail(503, "合言葉がまだ決められていません。サイト担当（AVERIX）に知らせてください");
    if (!sameText(b.data.pass.trim(), pass)) {
      allowHere(ipBucket, IP_LIMIT, 600);
      await allow(ipBucket, IP_LIMIT, 600);
      if (devBucket) {
        allowHere(devBucket, DEVICE_LIMIT, 600);
        await allow(devBucket, DEVICE_LIMIT, 600);
      } else {
        // 次からは端末ごとにも数える（人の情報ではない乱数。この窓口でだけ使う）
        jar.set(DEVICE_COOKIE, randomBytes(18).toString("base64url"), {
          httpOnly: true,
          secure: PROD,
          sameSite: "lax",
          path: "/api/staff/login",
          maxAge: 400 * 86400,
        });
      }
      return fail(401, "合言葉がちがいます。大文字・小文字、全角・半角も確かめてください");
    }
    const s = newSession("admin");
    jar.set(COOKIE, encodeSession(s), cookieOptions(s));
    return ok({ role: "admin", exp: s.exp });
  });
}
