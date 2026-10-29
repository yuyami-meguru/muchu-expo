import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { COOKIE, adminPassphrase, cookieOptions, encodeSession, newSession, sameText } from "@/lib/auth";
import { clientIp, fail, guarded, ok, readBody } from "@/lib/api";
import { allow } from "@/lib/store";

// 実行委員・先生の合言葉でログイン。10 分に 20 回まで（当てずっぽうを防ぐ。学校の Wi-Fi は全員が同じ IP なので少し多め。手元のテストでは 200 回）
const LIMIT = process.env.NODE_ENV === "production" ? 20 : 200;
export async function POST(req: NextRequest) {
  return guarded(async () => {
    const b = await readBody(req, z.object({ pass: z.string().max(200) }));
    if ("error" in b) return b.error;
    if (!(await allow(`login:${clientIp(req)}`, LIMIT, 600))) return fail(429, "何度もまちがえたので、10 分ほど待ってからためしてください");
    const pass = adminPassphrase();
    if (!pass) return fail(503, "合言葉がまだ設定されていません（ADMIN_PASSPHRASE を 12 文字以上で）");
    if (!sameText(b.data.pass.trim(), pass)) return fail(401, "合言葉がちがいます");
    const s = newSession("admin");
    (await cookies()).set(COOKIE, encodeSession(s), cookieOptions(s));
    return ok({ role: "admin" });
  });
}
