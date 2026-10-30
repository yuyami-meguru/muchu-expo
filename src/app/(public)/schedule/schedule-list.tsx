"use client";

import Link from "next/link";
import { useState } from "react";
import type { TimedRow } from "@/lib/schedule";
import { markOf, minutesToGo, useEventMinute } from "../_components/clock";
import { RowPlace } from "../_components/row-place";

/**
 * タイムテーブルの 1 行：時刻・すること（押すとお店のページ）・場所（押すとマップ）。
 * mark は当日だけの札（いまやっている・おわり）、soon は始まるまでの分（15 分前から「あと N 分」）
 */
export function ScheduleRow({ r, mark = null, soon = null }: { r: TimedRow; mark?: "now" | "done" | null; soon?: number | null }) {
  return (
    <li className={`tone-${r.color}${mark === "done" ? " sc-row--done" : ""}`}>
      {mark === "now" && <span className="sc-now">いまやっている</span>}
      {mark === "done" && <span className="sc-done">おわり</span>}
      {soon !== null && <span className="sc-soon">あと {soon} 分</span>}
      <span className="sc-time">{r.time || "—"}</span>
      <div className="sc-body">
        <Link href={`/shops/${r.shopId}`} className="sc-main">
          <span className="sc-text">{r.text}</span>
          <span className="sc-shop">
            {r.deptShort} ・ {r.shopName}
          </span>
        </Link>
        <RowPlace place={r.place} placeId={r.placeId} className="sc-place" />
      </div>
    </li>
  );
}

/**
 * 時刻の決まった行（時刻の順）。当日だけ「いまやっている」「おわり」と、始まる 15 分前からの「あと N 分」を出す（30 秒ごとに見直す・端末の時計で）。
 * 「いまやっている」は始まってから、次の“ちがう時刻”の行が始まるまで・長くて 30 分（ホームの「このあと」と同じ。clock.ts の markOf）。
 * おわったものがあれば「これからの予定だけ」で隠せる
 */
export function ScheduleList({ rows }: { rows: TimedRow[] }) {
  const now = useEventMinute();
  const [onlyNext, setOnlyNext] = useState(false);
  const mins = rows.map((r) => r.min ?? 0);
  const marks = rows.map((_, i) => markOf(mins, i, now));
  const doneCount = marks.filter((m) => m === "done").length;

  return (
    <>
      {doneCount > 0 && (
        <p className="sc-tools">
          <button type="button" className="sc-toggle" aria-pressed={onlyNext} onClick={() => setOnlyNext((v) => !v)}>
            <span className="sc-toggle-box" aria-hidden="true">
              {onlyNext ? "✓" : ""}
            </span>
            これからの予定だけ
          </button>
          {onlyNext && <span className="sc-hidden-n">おわった {doneCount} 件を隠しています</span>}
        </p>
      )}
      {onlyNext && doneCount === rows.length && <p className="sc-empty">きょうの予定は、すべて終わりました。</p>}
      <ol className="sc-list">
        {rows.map((r, i) => (onlyNext && marks[i] === "done" ? null : <ScheduleRow key={i} r={r} mark={marks[i]} soon={marks[i] ? null : minutesToGo(r.min, now)} />))}
      </ol>
    </>
  );
}
