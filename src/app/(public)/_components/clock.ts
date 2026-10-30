import { useSyncExternalStore } from "react";
import { DAY_END, DAY_START } from "@/lib/ops";

// 当日（2026-11-28、日本時間）の「いまの時刻」。タイムテーブルの「いまやっている」・このあと・送迎バスで使う（画面の側だけ・端末の時計で）
const subscribe = (fn: () => void) => {
  const t = setInterval(fn, 30_000);
  return () => clearInterval(t);
};
function minuteOfEventDay(): number | null {
  const now = Date.now();
  if (now < DAY_START || now >= DAY_END) return null;
  return Math.floor((now - DAY_START) / 60_000);
}

/** 当日なら 0 時からの分（30 秒ごとに見直す）。ほかの日・サーバーと最初の描画では null */
export function useEventMinute(): number | null {
  return useSyncExternalStore(subscribe, minuteOfEventDay, () => null);
}

/** 時刻の順に並んだ mins の i 番目より後で、ちがう時刻の最初のもの（同じ時刻の行が並んでいても、すぐ「おわり」にしない） */
export function nextOtherTime(mins: number[], i: number): number | null {
  for (let j = i + 1; j < mins.length; j++) if (mins[j] > mins[i]) return mins[j];
  return null;
}

/** 「まもなく」の札を出すのは、始まるこの分数前から */
export const SOON_MIN = 15;

/** 「いまやっている」とみなす長さ（終わりの時刻は無いので、次の予定まで・長くて 30 分）。ホームの「このあと」とタイムテーブルで同じ */
export const NOW_MAX = 30;

/**
 * 時刻の順に並んだ mins の i 番目の札：now＝いまやっている（始まってから、次のちがう時刻まで・長くて 30 分）、
 * done＝おわり（次のちがう時刻の予定が始まった。最後の行は始まって 30 分）。そのあいだ（30 分をこえて次がまだ）は札なし（分からないので言い切らない）
 */
export function markOf(mins: number[], i: number, now: number | null): "now" | "done" | null {
  if (now === null || now < mins[i]) return null;
  const next = nextOtherTime(mins, i);
  if (now < Math.min(next ?? Infinity, mins[i] + NOW_MAX)) return "now";
  return now >= (next ?? mins[i] + NOW_MAX) ? "done" : null;
}

/** 始まるまであと何分か（SOON_MIN 分前から 1 分前まで。それ以外・当日でないときは null）。札は「あと N 分」 */
export function minutesToGo(start: number | null, now: number | null): number | null {
  if (start === null || now === null) return null;
  const d = start - now;
  return d >= 1 && d <= SOON_MIN ? d : null;
}
