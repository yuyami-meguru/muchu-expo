import { useSyncExternalStore } from "react";
import { DAY_START } from "@/lib/ops";

// 当日（2026-11-28、日本時間）の「いまの時刻」。タイムテーブルの「いまここ」・このあと・送迎バスで使う（画面の側だけ）
const DAY_MS = 86_400_000;
const subscribe = (fn: () => void) => {
  const t = setInterval(fn, 30_000);
  return () => clearInterval(t);
};
function minuteOfEventDay(): number | null {
  const now = Date.now();
  if (now < DAY_START || now >= DAY_START + DAY_MS) return null;
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
