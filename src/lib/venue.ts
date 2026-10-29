// 会場の情報（アクセス・地図アプリのボタン・埋め込みの地図で使う）。ここだけ直せば全部の画面が変わる。

export const VENUE = {
  name: "広島工業大学高等学校 沼田校舎",
  address: "広島市安佐南区伴北六丁目",
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
  return p ? `https://maps.apple.com/?ll=${p.lat},${p.lon}&q=${q}` : `https://maps.apple.com/?q=${q}&sll=${VENUE.near.lat},${VENUE.near.lon}`;
}

/** Google マップ */
export function googleMapsUrl() {
  const p = VENUE.point;
  return p
    ? `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lon}`
    : `https://www.google.com/maps/search/?api=1&query=${q}`;
}

/** 埋め込みの地図（OpenStreetMap。鍵もお金もいらない）。位置が未確認なら null */
export function embedMapUrl() {
  const p = VENUE.point;
  if (!p) return null;
  const d = 0.006;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${p.lon - d},${p.lat - d * 0.75},${p.lon + d},${p.lat + d * 0.75}&layer=mapnik&marker=${p.lat},${p.lon}`;
}
