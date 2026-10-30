import type { NextRequest } from "next/server";
import { clientIp, fail, guarded, ok, readBody } from "@/lib/api";
import { addSurvey, allow, loadAll, surveyOpen } from "@/lib/store";
import { isEmptyAnswer, surveyBody, type SurveyAnswer } from "@/lib/survey";

// お客さんのアンケートの回答。ログインはいらない。
// 回数の上限は「つなぎ先（IP）」ごとに 10 分 600 回。会場の Wi-Fi は全員が同じ IP になることがあるので大きめにし、
// いたずらの連打だけ止める（ほかは見えない欄と受付のオン・オフで防ぐ）
const LIMIT = process.env.NODE_ENV === "production" ? 600 : 1000;

export async function POST(req: NextRequest) {
  return guarded(async () => {
    const b = await readBody(req, surveyBody);
    if ("error" in b) return b.error;
    if (!(await surveyOpen())) return fail(403, "アンケートの受付は終わりました。ありがとうございました");
    if (!(await allow(`survey:${clientIp(req)}`, LIMIT, 600))) return fail(429, "いま回答がとても多いため、受け付けられませんでした。1 分ほど待ってから、もう一度「送る」を押してください");
    const { website, ...a } = b.data;
    // 見えない欄に何か入っていたら機械の送りつけ。送れたふりをして保存しない
    if (website) return ok();
    if (isEmptyAnswer(b.data)) return fail(400, "どれか 1 つでも答えてから送ってください");
    const { shops } = await loadAll();
    const ids = new Set(shops.filter((s) => !s.hidden).map((s) => s.id));
    const answer: SurveyAnswer = { ...a, fav: [...new Set(a.fav)].filter((id) => ids.has(id)), at: Date.now(), v: 1 };
    await addSurvey(JSON.stringify(answer));
    return ok();
  });
}
