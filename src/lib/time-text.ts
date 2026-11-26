// タイムテーブルの時刻の文の見せ方（お店の人が書いた「10:00〜12:00」「11:00-11:10」「１０：００～」など）。
// ほかを読み込まない小さな部品（画面の側でもサーバーの側でも使う）

/** 時刻の区切りに使われる字（「〜」「~」「-」「‐」「–」「—」「ー」「－」など。全角の一部は NFKC で半角になる） */
const SEP = "[~〜\\-‐‑‒–—―ーｰ－]";
const RANGE = new RegExp(`^(\\d{1,2}:\\d{2})\\s*(?:(${SEP})\\s*(\\d{1,2}:\\d{2})?)?$`);

/**
 * 時刻の文を「始め」と「終わり」に分ける（「10:00〜12:00」→ 10:00 と 12:00、「11:00-11:10」→ 11:00 と 11:10、「10:00」→ 10:00 だけ、
 * 「10:00〜」→ 10:00 から）。区切りは見せるときに「〜」へそろえる。時刻だけでできていない文（「午前中」「10時ごろ」など）は null（そのまま出す）
 */
export function timeParts(raw: string): { from: string; to: string; open: boolean } | null {
  const m = raw.normalize("NFKC").trim().match(RANGE);
  if (!m) return null;
  return { from: m[1], to: m[3] ?? "", open: !m[3] && !!m[2] };
}

/** 1 行で書くときの時刻（区切りを「〜」に。読めない文はそのまま） */
export function timeLabel(raw: string) {
  const p = timeParts(raw);
  if (!p) return raw.trim();
  return p.to ? `${p.from}〜${p.to}` : p.open ? `${p.from}〜` : p.from;
}
