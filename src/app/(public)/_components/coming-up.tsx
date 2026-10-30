"use client";

import Link from "next/link";
import { usePhase } from "@/components/live/live-provider";
import type { TimedRow } from "@/lib/schedule";
import { nextOtherTime, useEventMinute } from "./clock";

/** 「いまやっている」とみなす長さ（終わりの時刻は無いので、次の予定まで・長くて 30 分） */
const NOW_MAX = 30;

/**
 * ホームの「このあと」。当日は、始まってから次の（ちがう時刻の）予定まで（長くて 30 分）を「いまやっている」として先頭に、
 * そのあとにこれからのものを 3 つ。ほかの日は最初の 3 つ。終了後は出さない
 */
export function ComingUp({ rows }: { rows: TimedRow[] }) {
  const phase = usePhase();
  const now = useEventMinute();
  if (!rows.length || phase === "after") return null;
  const mins = rows.map((r) => r.min ?? 0);
  const isNow = (i: number) => now !== null && mins[i] <= now && now < Math.min(nextOtherTime(mins, i) ?? Infinity, mins[i] + NOW_MAX);
  const current = rows.map((r, i) => ({ r, i })).filter(({ i }) => isNow(i));
  const later = rows
    .map((r, i) => ({ r, i }))
    .filter(({ i }) => now === null || mins[i] > now)
    .slice(0, 3);
  const list = [...current, ...later];
  return (
    <div className="hm-next">
      <h3>このあと</h3>
      {list.length ? (
        <ul>
          {list.map(({ r, i }) => {
            const on = isNow(i);
            return (
              <li key={i} className={`tone-${r.color}${on ? " hm-next--now" : ""}`}>
                <span className="hm-next-t">{r.time}</span>
                <Link href={`/shops/${r.shopId}`}>
                  {on && <em className="hm-next-now">いまやっている</em>}
                  {r.text}
                  <small>
                    {r.deptShort} ・ {r.shopName}
                  </small>
                </Link>
              </li>
            );
          })}
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
