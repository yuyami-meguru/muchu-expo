"use client";

import Link from "next/link";
import { minutesOf } from "@/lib/schedule";
import { BUS_FROM_SCHOOL } from "../info/bus";
import { useEventMinute } from "./clock";

/** 学校発の、now（当日の 0 時からの分）より後の最初の便（「13:10」。もう無ければ undefined） */
export const nextBusFromSchool = (now: number) => BUS_FROM_SCHOOL.find((t) => (minutesOf(t) ?? 0) >= now);

/**
 * 当日だけ：学校発の次の無料送迎バス（ホームに小さく出す。終了後は big で大きく「帰りの送迎バス」）。
 * 押すと、ご来場の方へのバスの時刻へ
 */
export function NextBus({ big }: { big?: boolean }) {
  const now = useEventMinute();
  if (now === null) return null;
  const next = nextBusFromSchool(now);
  return (
    <Link href="/info#bus" className={big ? "hm-bus hm-bus--big" : "hm-bus"}>
      <span className="hm-bus-k">{big ? "帰りの無料送迎バス（学校発）" : "次の送迎バス（学校発）"}</span>
      {next ? <strong className="hm-bus-t">{next} 発</strong> : <strong className="hm-bus-t hm-bus-t--end">本日の送迎バスは、すべて出ました</strong>}
      <span className="hm-bus-go">
        時刻を見る<span aria-hidden="true"> ▶</span>
      </span>
    </Link>
  );
}
