"use client";

import type { ReactNode } from "react";
import { usePhase } from "@/components/live/live-provider";
import type { Phase } from "@/lib/ops";

/** 当日（朝・開催中）か */
export const isDay = (p: Phase) => p === "morning" || p === "during";

/** 表示の時期（開催前・当日の朝・開催中・終了後）が only のどれかのときだけ中身を出す */
export function InPhase({ only, children }: { only: Phase[]; children: ReactNode }) {
  return only.includes(usePhase()) ? children : null;
}

/**
 * 表示の時期で出すものを変える（before＝開催前、day＝当日の朝・開催中、after＝終了後。渡さなかった時期は何も出さない）。
 * 時期は「いまの様子」から決めるので、サーバーで設定を読み直さずに済む（Upstash の回数を増やさない）。中身はサーバーで作って渡してよい
 */
export function ByPhase({ before, day, after }: { before?: ReactNode; day?: ReactNode; after?: ReactNode }) {
  const p = usePhase();
  return (p === "before" ? before : p === "after" ? after : day) ?? null;
}
