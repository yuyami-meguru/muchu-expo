import { deptLookup, type Dept, type Shop } from "./types";

/**
 * 「10:30」「１０：３０」「10時30分」「10時」「11.30」「午後1時」を分に直す。読めなければ null（「午前中」など）。
 * 全角の数字・記号は半角にそろえてから読む。催しは 10〜14 時なので、「午前」と書いていない 1〜7 時は午後とみなす（「1時から」→ 13:00）
 */
export function minutesOf(raw: string): number | null {
  const t = raw.normalize("NFKC");
  const m = t.match(/(\d{1,2})\s*(?:[:.]|時)\s*(\d{1,2})?/);
  if (!m) return null;
  let h = Number(m[1]);
  const mm = m[2] ? Number(m[2]) : 0;
  if (/午後|pm/i.test(t)) {
    if (h < 12) h += 12;
  } else if (!/午前|am/i.test(t) && h >= 1 && h <= 7) {
    h += 12;
  }
  return h <= 23 && mm <= 59 ? h * 60 + mm : null;
}

/** 分を「13:05」の形に */
export function hhmm(min: number) {
  return `${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")}`;
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
