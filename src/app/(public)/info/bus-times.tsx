"use client";

import { minutesOf } from "@/lib/schedule";
import { useEventMinute } from "../_components/clock";

/**
 * 送迎バスの時刻の並び。当日は、いまより後の最初の便を「次は 13:10 発」と強く出し、出た便はうすくする。
 * 押せる物に見えないよう、札にせず表のように並べる
 */
export function BusTimes({ times, label, showNext }: { times: string[]; label: string; showNext?: boolean }) {
  const now = useEventMinute();
  const mins = times.map((t) => minutesOf(t) ?? 0);
  const next = now === null ? -1 : mins.findIndex((m) => m >= now);
  return (
    <>
      {showNext && now !== null && (
        <p className="if-next" role="status">
          {next >= 0 ? (
            <>
              次は <strong>{times[next]} 発</strong>
            </>
          ) : (
            "本日の送迎バスは、すべて出ました。"
          )}
        </p>
      )}
      <ol className="if-times" aria-label={label}>
        {times.map((t, i) => {
          const gone = now !== null && (next < 0 || i < next);
          return (
            <li key={t} className={gone ? "is-gone" : i === next ? "is-next" : undefined}>
              {t}
              {gone && <span className="sr-only">（出発しました）</span>}
              {i === next && <span className="sr-only">（次の便）</span>}
            </li>
          );
        })}
      </ol>
    </>
  );
}
