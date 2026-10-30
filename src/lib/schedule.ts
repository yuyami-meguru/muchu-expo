import { deptLookup, placeLabeler, type Area, type Dept, type Place, type Shop } from "./types";

/**
 * 「10:30」「１０：３０」「10時30分」「10時」「11.30」「午後1時」「1時半」「13時半」「正午」を分に直す。読めなければ null（「午前中」など）。
 * 全角の数字・記号は半角にそろえてから読む。催しは 10〜14 時なので、「午前」と書いていない 1〜7 時は午後とみなす（「1時から」→ 13:00）。
 * 「11時〜正午」のように 2 つ書いてあるときは、先に書いてある方
 */
export function minutesOf(raw: string): number | null {
  const t = raw.normalize("NFKC");
  // 時と分：「10:30」「11.30」「10時」「10時30分」「1時半」
  const m = t.match(/(\d{1,2})\s*(?:[:.]\s*(\d{1,2})?|時\s*(?:(半)|(\d{1,2})\s*分?)?)/);
  const noon = t.indexOf("正午");
  if (noon >= 0 && (!m || noon < (m.index ?? 0))) return 12 * 60;
  if (!m) return null;
  let h = Number(m[1]);
  const mm = m[2] ? Number(m[2]) : m[3] ? 30 : m[4] ? Number(m[4]) : 0;
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

/**
 * タイムテーブルの 1 行。place はお店の場所（「知育館 3階・301 教室」。地図のピンが無ければ場所の補足、どちらも無ければ空）、
 * placeId は地図で指す場所（地図のピンが無いお店は空。押すとマップの ?place= へ）
 */
export type TimedRow = {
  shopId: string;
  shopName: string;
  deptShort: string;
  color: string;
  time: string;
  text: string;
  min: number | null;
  place: string;
  placeId: string;
};

/** かっこの中が「場所」ではなさそうな言葉（「（予定）」「（時刻は準備中）」「（先着 20 名）」など） */
const NOT_PLACE = /予定|時刻|時間|準備中|未定|仮|変更|約|分|先着|名|人|円|無料|雨|回|頃|ごろ|まで|から/;

/**
 * 行の文に、お店とはちがう場所が書いてありそうか（「バンド演奏（中庭）」）。
 * そういう行にお店の場所（「301 教室」）を添えると食いちがうので、場所は出さない（文に書いてある場所を読んでもらう）
 */
export function hasOwnPlace(text: string) {
  const inner = [...text.normalize("NFKC").matchAll(/\(([^()]+)\)/g)].map((m) => m[1].trim());
  return inner.some((s) => s && !NOT_PLACE.test(s));
}

/**
 * 全部のお店の「当日の流れ」を 1 本に（時刻のあるものは時刻の順）。
 * map（地図のピンとフロア）を渡すと、行にお店の場所も入れる（渡さなければ場所は空）。
 * 文にかっこで別の場所が書いてある行（「バンド演奏（中庭）」）には、お店の場所を添えない
 */
export function allSchedule(shops: Shop[], depts: Dept[], map?: { places: Place[]; areas: Area[] }) {
  const dept = deptLookup(depts);
  const where = placeLabeler(map?.areas ?? []);
  const placeById = new Map((map?.places ?? []).map((p) => [p.id, p]));
  const rows = shops
    .filter((s) => !s.hidden)
    .flatMap((s) => {
      const p = placeById.get(s.placeId);
      const place = p ? where(p) : map ? s.placeNote : "";
      return s.schedule.map((x) => {
        const own = hasOwnPlace(x.text);
        return {
          shopId: s.id,
          shopName: s.name,
          deptShort: dept(s.dept).short,
          color: dept(s.dept).color,
          time: x.time,
          text: x.text,
          min: minutesOf(x.time),
          place: own ? "" : place,
          placeId: own ? "" : (p?.id ?? ""),
          order: s.order,
        };
      });
    })
    .sort((a, b) => (a.min ?? 9999) - (b.min ?? 9999) || a.order - b.order);
  const timed: TimedRow[] = rows.filter((r) => r.min !== null);
  const other: TimedRow[] = rows.filter((r) => r.min === null);
  return { timed, other };
}
