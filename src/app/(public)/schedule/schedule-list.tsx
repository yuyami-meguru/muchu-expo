"use client";

import Link from "next/link";
import { useState } from "react";
import type { TimedRow } from "@/lib/schedule";
import { nextOtherTime, useEventMinute } from "../_components/clock";

/** 最後の行（次の予定が無いもの）を「いまここ」にしておく長さ */
const LAST_MIN = 30;

/**
 * 時刻の決まった行（時刻の順）。当日だけ「いまここ」「おわり」を出す（1 分ごとに見直す）。
 * 「いまここ」は始まってから、次の“ちがう時刻”の行が始まるまで（同じ時刻の行が並んでいても、すぐ「おわり」にしない）。
 * おわったものがあれば「これからの予定だけ」で隠せる
 */
export function ScheduleList({ rows }: { rows: TimedRow[] }) {
  const now = useEventMinute();
  const [onlyNext, setOnlyNext] = useState(false);
  const mins = rows.map((r) => r.min ?? 0);
  const mark = (i: number): "now" | "done" | null => {
    if (now === null || now < mins[i]) return null;
    const next = nextOtherTime(mins, i);
    return now < (next ?? mins[i] + LAST_MIN) ? "now" : "done";
  };
  const marks = rows.map((_, i) => mark(i));
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
        {rows.map((r, i) =>
          onlyNext && marks[i] === "done" ? null : (
            <li key={i} className={`tone-${r.color}${marks[i] === "done" ? " sc-row--done" : ""}`}>
              {marks[i] === "now" && <span className="sc-now">いまここ</span>}
              {marks[i] === "done" && <span className="sc-done">おわり</span>}
              <span className="sc-time">{r.time}</span>
              <Link href={`/shops/${r.shopId}`} className="sc-body">
                <span className="sc-text">{r.text}</span>
                <span className="sc-shop">
                  {r.deptShort} ・ {r.shopName}
                </span>
              </Link>
            </li>
          ),
        )}
      </ol>
    </>
  );
}
