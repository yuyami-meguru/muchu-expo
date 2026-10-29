import { deptLookup, type Dept, type Shop } from "./types";

/** 「10:30」「10：30」「10時30分」「10時」を分に直す。読めなければ null（「午前」など） */
export function minutesOf(t: string): number | null {
  const m = t.match(/(\d{1,2})\s*[:：時]\s*(\d{1,2})?/);
  if (!m) return null;
  const h = Number(m[1]);
  const mm = m[2] ? Number(m[2]) : 0;
  return h <= 23 && mm <= 59 ? h * 60 + mm : null;
}

export type TimedRow = { shopId: string; shopName: string; deptShort: string; color: string; time: string; text: string; min: number | null };

/** 全部のお店の「当日の流れ」を 1 本に（時刻のあるものは時刻の順） */
export function allSchedule(shops: Shop[], depts: Dept[]) {
  const dept = deptLookup(depts);
  const rows: TimedRow[] = shops
    .filter((s) => !s.hidden)
    .flatMap((s) =>
      s.schedule.map((x) => ({ shopId: s.id, shopName: s.name, deptShort: dept(s.dept).short, color: dept(s.dept).color, time: x.time, text: x.text, min: minutesOf(x.time), order: s.order })),
    )
    .sort((a, b) => (a.min ?? 9999) - (b.min ?? 9999) || a.order - b.order);
  return { timed: rows.filter((r) => r.min !== null), other: rows.filter((r) => r.min === null) };
}
