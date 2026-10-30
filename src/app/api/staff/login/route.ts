import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { COOKIE, adminPassphrase, cookieOptions, encodeSession, newSession, sameText } from "@/lib/auth";
import { clientIp, fail, guarded, ok, readBody } from "@/lib/api";
import { allow, blocked } from "@/lib/store";

// 実行委員・先生の合言葉でログイン。まちがいは 10 分に 30 回まで（当てずっぽうを防ぐ）。
// 数えるのはまちがえたときだけ（学校の Wi-Fi は全員が同じ IP なので、正しく入った人は数えない）。手元のテストでは 200 回
const LIMIT = process.env.NODE_ENV === "production" ? 30 : 200;
export async function POST(req: NextRequest) {
  return guarded(async () => {
    const b = await readBody(req, z.object({ pass: z.string().max(200) }));
    if ("error" in b) return b.error;
    const bucket = `login:${clientIp(req)}`;
    if (await blocked(bucket, LIMIT)) return fail(429, "合言葉のまちがいが続いたため、10 分ほど止めています。合言葉を確かめてから、もう一度ためしてください");
    const pass = adminPassphrase();
    if (!pass) return fail(503, "合言葉がまだ決められていません。サイト担当（AVERIX）に知らせてください");
    if (!sameText(b.data.pass.trim(), pass)) {
      await allow(bucket, LIMIT, 600);
      return fail(401, "合言葉がちがいます。大文字・小文字、全角・半角も確かめてください");
    }
    const s = newSession("admin");
    (await cookies()).set(COOKIE, encodeSession(s), cookieOptions(s));
    return ok({ role: "admin" });
  });
}
