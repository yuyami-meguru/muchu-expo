import type { Phase } from "@/lib/ops";
import type { SendResult } from "../_lib/client";

export type Result = { text: string; error?: boolean } | null;

/** 押した結果の文。押したカードの中（ボタンのすぐ下）に出す。失敗は赤 */
export function ResultLine({ r }: { r: Result }) {
  return (
    <p className={r?.error ? "ops-result ops-result--ng" : "ops-result"} role={r?.error ? "alert" : "status"}>
      {r?.text}
    </p>
  );
}

type Fail = Extract<SendResult, { ok: false }>;

/** 実行委員が出したものが、お客さんの画面に届くまで（開いたままの画面は読み直しの間かくで。開催前は間かくが長い） */
export const REACH = "当日は 20 秒ほどで、お客さんの画面に出ます（開催前は、数分かかることがあります）";

/**
 * 従業員側の画面が読み直す間隔（_lib/use-staff-live.ts と同じ）：当日の朝・開催中は 15 秒、開催前・終了後は 60 秒
 * （開催前・終了後は売り切れなどがお客さんに出ないので、Upstash の回数を増やさない）
 */
export const quietPhase = (p: Phase) => p !== "morning" && p !== "during";
export const pollMs = (p: Phase) => (quietPhase(p) ? 60_000 : 15_000);
/** 「15 秒ごと」「1 分ごと」 */
export const everyText = (p: Phase) => (quietPhase(p) ? "1 分ごと" : "15 秒ごと");

/** ログインが切れた答えか（ログインが無いと 401。お店の人のログインのまま実行委員の操作をすると 403） */
export const isLoggedOut = (r: Fail) => r.status === 401 || r.status === 403;

/**
 * 実行委員の画面の、うまくいかなかったときの文。what は「『焼きそば』を「売り切れ」に」のような「何を」の所。
 *  - 返事が来なかった（unsure）：届いているかもしれないので「できませんでした」とは言わない（呼ぶ側で、すぐ読み直す）
 *  - ログインが切れた（401）：［もう一度］ではなく、入り直し方（画面のいちばん上の帯）
 *  - そのほか：サーバーの文（何が起きて、どうすればいいか）をそのまま続ける
 */
export function failMsg(what: string, r: Fail, unsureNext = "いまの様子を読み直して確かめています") {
  if (r.unsure) return `${what}できたか、まだ分かりません（返事が来ませんでした）。${unsureNext}`;
  if (isLoggedOut(r)) return `${what}できませんでした。ログインが切れています。画面のいちばん上の［合言葉で入り直す］から入り直して、もう一度押してください`;
  return `${what}できませんでした。${r.error}`;
}
