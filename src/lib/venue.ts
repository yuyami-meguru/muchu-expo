// 行事と会場の情報（日時・アクセス・地図アプリのボタン・埋め込みの地図で使う）。ここだけ直せば全部の画面が変わる。
// 2026-10-29 に学校が出したパンフレット（kodaikoko.ed.jp/encourage/img/mutyubanpaku_261128.pdf）に合わせた。

export const EVENT = {
  date: "2026年11月28日（土）",
  hours: "10:00〜14:00",
  organizer: "広島工業大学高等学校 通信制課程 エンカレッジコース",
  tel: "082-849-6755",
  web: "https://www.kodaikoko.ed.jp/",
  instagram: "https://www.instagram.com/kodaikoko_encourage/",
};

export const VENUE = {
  name: "広島工業大学 沼田校舎",
  postal: "731-3163",
  address: "広島市安佐南区伴北6丁目4104-2",
  /**
   * 正確な位置（緯度・経度）。分かったら入れる → 埋め込みの地図が出て、地図アプリのピンもぴったりになる。
   * Apple マップで学校を開いて「共有」→「リンクをコピー」したものの ll= の数字。いまは未確認なので null
   */
  point: null as null | { lat: number; lon: number },
  /** 位置が分からないあいだ、地図アプリの検索をこのあたりに寄せる（伴北六丁目の中心。OpenStreetMap で調べた） */
  near: { lat: 34.482223, lon: 132.396193 },
};

const q = encodeURIComponent(VENUE.name);

/** Apple マップ（iPhone・Mac ではアプリ、ほかはブラウザの Apple マップ） */
export function appleMapsUrl() {
  const p = VENUE.point;
  return p
    ? `https://maps.apple.com/?ll=${p.lat},${p.lon}&q=${q}`
    : `https://maps.apple.com/?q=${q}&address=${encodeURIComponent(VENUE.address)}&sll=${VENUE.near.lat},${VENUE.near.lon}`;
}

/** Google マップ */
export function googleMapsUrl() {
  const p = VENUE.point;
  return p
    ? `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lon}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${VENUE.name} ${VENUE.address}`)}`;
}

/** 埋め込みの地図（OpenStreetMap。鍵もお金もいらない）。位置が未確認なら null */
export function embedMapUrl() {
  const p = VENUE.point;
  if (!p) return null;
  const d = 0.006;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${p.lon - d},${p.lat - d * 0.75},${p.lon + d},${p.lat + d * 0.75}&layer=mapnik&marker=${p.lat},${p.lon}`;
}
