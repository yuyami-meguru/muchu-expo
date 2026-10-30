"use client";

import Link from "next/link";
import { usePhase } from "@/components/live/live-provider";
import type { TimedRow } from "@/lib/schedule";
import { markOf, minutesToGo, useEventMinute } from "./clock";
import { RowPlace } from "./row-place";

/**
 * ホームの「このあと」（表紙の［このあと］の行き先なので id="next"）。当日は、始まってから次の（ちがう時刻の）予定まで（長くて 30 分）を
 * 「いまやっている」として先頭に、そのあとにこれからのものを 3 つ。始まる 15 分前からは「あと N 分」（端末の時計で）。
 * 開催前は「当日の予定」として最初の 3 つ。終了後は出さない。行には場所も（押すとマップ）
 */
export function ComingUp({ rows }: { rows: TimedRow[] }) {
  const phase = usePhase();
  const now = useEventMinute();
  if (!rows.length || phase === "after") return null;
  const mins = rows.map((r) => r.min ?? 0);
  const isNow = (i: number) => markOf(mins, i, now) === "now";
  const current = rows.map((r, i) => ({ r, i })).filter(({ i }) => isNow(i));
  const later = rows
    .map((r, i) => ({ r, i }))
    .filter(({ i }) => now === null || mins[i] > now)
    .slice(0, 3);
  const list = [...current, ...later];
  return (
    <div className="hm-next" id="next">
      <h3>{phase === "before" ? "当日の予定" : "このあと"}</h3>
      {list.length ? (
        <ul>
          {list.map(({ r, i }) => {
            const on = isNow(i);
            const soon = on ? null : minutesToGo(r.min, now);
            return (
              <li key={i} className={`tone-${r.color}${on ? " hm-next--now" : ""}`}>
                <span className="hm-next-t">{r.time}</span>
                <span className="hm-next-b">
                  <Link href={`/shops/${r.shopId}`} className="hm-next-main">
                    {on && <em className="hm-next-now">いまやっている</em>}
                    {soon !== null && <em className="hm-next-soon">あと {soon} 分</em>}
                    <span className="hm-next-text">{r.text}</span>
                    <small>
                      {r.deptShort} ・ {r.shopName}
                    </small>
                  </Link>
                  <RowPlace place={r.place} placeId={r.placeId} className="hm-next-place" />
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p>きょうの予定はすべて終わりました。</p>
      )}
      <Link href="/schedule" className="hm-next-all">
        タイムテーブルをぜんぶ見る<span aria-hidden="true"> ▶</span>
      </Link>
    </div>
  );
}
