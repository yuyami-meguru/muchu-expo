"use client";

import { useSyncExternalStore } from "react";
import { usePhase } from "@/components/live/live-provider";
import { EVENT } from "@/lib/venue";

function daysLeft() {
  const jst = new Date(Date.now() + 9 * 3600e3);
  const today = Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), jst.getUTCDate());
  return Math.round((Date.UTC(2026, 10, 28) - today) / 86400e3);
}
const noop = () => () => {};

/**
 * 表紙の札。開催前は開催日までの日数、当日の朝は「まもなく開場」、10:00〜14:00 は「開催中」、14:00 からは「ありがとうございました」。
 * いつかは表示の時期（usePhase）で決める。日数だけは、サーバーと画面で日付がずれないよう画面で数える
 */
export function Countdown() {
  const phase = usePhase();
  const days = useSyncExternalStore(noop, daysLeft, () => null);
  if (phase === "after")
    return (
      <>
        <span className="cd-l">ご来場</span>
        <span className="cd-n cd-today">感謝！</span>
        <span className="cd-u">ありがとうございました</span>
      </>
    );
  if (phase === "during")
    return (
      <>
        <span className="cd-l">本日</span>
        <span className="cd-n cd-today">開催中！</span>
        <span className="cd-u">{EVENT.hours}</span>
      </>
    );
  if (phase === "morning" || (days !== null && days <= 0))
    return (
      <>
        <span className="cd-n cd-today">まもなく開場</span>
        <span className="cd-u">（10:00〜）</span>
      </>
    );
  if (days === null) return <span className="cd-n">…</span>;
  return (
    <>
      <span className="cd-l">開催まで あと</span>
      <span className="cd-n">{days}</span>
      <span className="cd-u">日</span>
    </>
  );
}
