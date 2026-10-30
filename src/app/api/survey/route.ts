import type { NextRequest } from "next/server";
import { clientIp, fail, guarded, ok, readBody } from "@/lib/api";
import { parsePhaseMode, phaseOf } from "@/lib/ops";
import { addSurvey, allow, allowHere, getSetting, loadAll, surveyOpen } from "@/lib/store";
import { isEmptyAnswer, SURVEY_LABELS, surveyBody, type SurveyAnswer } from "@/lib/survey";

// お客さんのアンケートの回答。ログインはいらない。
// 回数の上限は「つなぎ先（IP）」ごとに 10 分 600 回。会場の Wi-Fi は全員が同じ IP になることがあるので大きめにし、
// いたずらの連打だけ止める（ほかは見えない欄と受付のオン・オフで防ぐ）。
// 連打はまずこのサーバーの中の回数で止める（Upstash を使わない）。受付の設定・お店の一覧は使い回す（store.ts）
const LIMIT = process.env.NODE_ENV === "production" ? 600 : 1000;
const TOO_MANY = "いま回答がとても多いため、受け付けられませんでした。数分待ってから、もう一度［アンケートを送る］を押してください";

export async function POST(req: NextRequest) {
  return guarded(async () => {
    const b = await readBody(req, surveyBody, { labels: SURVEY_LABELS });
    if ("error" in b) return b.error;
    const bucket = `survey:${clientIp(req)}`;
    if (!allowHere(bucket, LIMIT, 600)) return fail(429, TOO_MANY);
    const { website, device, ...a } = b.data;
    // 見えない欄に何か入っていたら機械の送りつけ。送れたふりをして保存しない
    if (website) return ok();
    if (isEmptyAnswer(b.data)) return fail(400, "どれか 1 つでも答えてから送ってください");
    // 開催前は受け付けない（練習で表示の時期を「当日」にしたときは受け付ける）
    if (phaseOf(Date.now(), parsePhaseMode(await getSetting("phase"))) === "before") return fail(409, "アンケートは 11/28（土）の当日からお願いします");
    if (!(await surveyOpen())) return fail(403, "アンケートの受付は終わりました。ありがとうございました");
    if (!(await allow(bucket, LIMIT, 600))) return fail(429, TOO_MANY);
    const { shops } = await loadAll();
    const ids = new Set(shops.filter((s) => !s.hidden).map((s) => s.id));
    const answer: SurveyAnswer = { ...a, fav: [...new Set(a.fav)].filter((id) => ids.has(id)), ...(device ? { device } : {}), at: Date.now(), v: 1 };
    await addSurvey(JSON.stringify(answer));
    return ok();
  });
}
