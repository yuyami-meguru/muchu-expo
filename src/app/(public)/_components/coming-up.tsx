"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import type { TimedRow } from "@/lib/schedule";

// 当日はいまの時刻より後のもの、それ以外の日は最初のものから 3 つ
const subscribe = (fn: () => void) => {
  const t = setInterval(fn, 60_000);
  return () => clearInterval(t);
};
function nowMin(): number {
  const jst = new Date(Date.now() + 9 * 3600e3);
  const today = jst.getUTCFullYear() === 2026 && jst.getUTCMonth() === 10 && jst.getUTCDate() === 28;
  return today ? jst.getUTCHours() * 60 + jst.getUTCMinutes() : -1;
}

export function ComingUp({ rows }: { rows: TimedRow[] }) {
  const now = useSyncExternalStore(subscribe, nowMin, () => -1);
  const next = rows.filter((r) => (r.min ?? 0) >= now).slice(0, 3);
  if (!rows.length) return null;
  return (
    <div className="hm-next">
      <h3>このあと</h3>
      {next.length ? (
        <ul>
          {next.map((r, i) => (
            <li key={i} className={`tone-${r.color}`}>
              <span className="hm-next-t">{r.time}</span>
              <Link href={`/shops/${r.shopId}`}>
                {r.text}
                <small>
                  {r.deptShort} ・ {r.shopName}
                </small>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p>きょうの予定はすべて終わりました。</p>
      )}
      <Link href="/schedule" className="hm-next-all">
        タイムテーブルをぜんぶ見る ▶
      </Link>
    </div>
  );
}
