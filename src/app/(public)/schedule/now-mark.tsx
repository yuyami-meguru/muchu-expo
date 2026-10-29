"use client";

import { useSyncExternalStore } from "react";

// 当日（2026-11-28、日本時間）だけ「いまここ」「おわり」を出す。1 分ごとに見直す
const subscribe = (fn: () => void) => {
  const t = setInterval(fn, 60_000);
  return () => clearInterval(t);
};
function nowMin(): number | null {
  const jst = new Date(Date.now() + 9 * 3600e3);
  if (jst.getUTCFullYear() !== 2026 || jst.getUTCMonth() !== 10 || jst.getUTCDate() !== 28) return null;
  return jst.getUTCHours() * 60 + jst.getUTCMinutes();
}

export function NowMark({ min, next }: { min: number; next: number | null }) {
  const now = useSyncExternalStore(subscribe, nowMin, () => null);
  if (now === null) return null;
  if (now >= min && (next === null ? now < min + 30 : now < next)) return <span className="sc-now">いまここ</span>;
  if (now >= min) return <span className="sc-done">おわり</span>;
  return null;
}
