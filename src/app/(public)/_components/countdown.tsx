"use client";

import { useSyncExternalStore } from "react";

function daysLeft() {
  const jst = new Date(Date.now() + 9 * 3600e3);
  const today = Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), jst.getUTCDate());
  return Math.round((Date.UTC(2026, 10, 28) - today) / 86400e3);
}
const noop = () => () => {};

/** 開催日までの日数（日本時間の日付で数える）。サーバーと画面で日付がずれないよう、画面で数える */
export function Countdown() {
  const days = useSyncExternalStore(noop, daysLeft, () => null);
  if (days === null) return <span className="cd-n">…</span>;
  if (days > 0)
    return (
      <>
        <span className="cd-l">開催まで あと</span>
        <span className="cd-n">{days}</span>
        <span className="cd-u">日</span>
      </>
    );
  if (days === 0)
    return (
      <>
        <span className="cd-l">本日</span>
        <span className="cd-n cd-today">開催中！</span>
        <span className="cd-u">11:00〜14:00</span>
      </>
    );
  return (
    <>
      <span className="cd-l">ご来場</span>
      <span className="cd-n cd-today">感謝！</span>
      <span className="cd-u">ありがとうございました</span>
    </>
  );
}
