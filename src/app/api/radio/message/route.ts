import { randomBytes } from "node:crypto";
import type { NextRequest } from "next/server";
import { clientIp, fail, guarded, ok, readBody } from "@/lib/api";
import { radioMsgBody, type RadioMsg } from "@/lib/radio";
import { loadRadio, MSG_MAX } from "@/lib/radio-server";
import { allow, pushList } from "@/lib/store";

// お客さんからラジオへのメッセージ（質問・メッセージ・リクエスト・クイズの答え）。ログインはいらない。
// 回数の上限は「つなぎ先（IP）」ごとに 10 分 30 回（いたずらの連打だけ止める）
const LIMIT = process.env.NODE_ENV === "production" ? 30 : 500;

export async function POST(req: NextRequest) {
  return guarded(async () => {
    const b = await readBody(req, radioMsgBody);
    if ("error" in b) return b.error;
    if (!(await loadRadio()).msgOpen) return fail(403, "いまはメッセージを受け付けていません");
    if (!(await allow(`radio:${clientIp(req)}`, LIMIT, 600))) return fail(429, "少し時間をおいてから、もう一度送ってください");
    const { website, ...m } = b.data;
    // 見えない欄に何か入っていたら機械の送りつけ。送れたふりをして保存しない
    if (website) return ok();
    const msg: RadioMsg = { id: randomBytes(5).toString("hex"), at: Date.now(), ...m };
    await pushList("radio-msg", JSON.stringify(msg), MSG_MAX);
    return ok();
  });
}
