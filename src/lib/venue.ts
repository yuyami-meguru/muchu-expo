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
   * 埋め込みの地図の印の位置（緯度・経度）。OpenStreetMap で「学校」として登録された建物（下大下バス停の西 約 400m）の真ん中。
   * パンフレットの地図・「下大下から正門まで徒歩 5 分」と合うが、だいたいの位置。地図アプリのボタンは名前と住所で探す（こちらの方が確か）
   */
  point: { lat: 34.48207, lon: 132.39544 } as null | { lat: number; lon: number },
  /** 位置が分からないあいだ、地図アプリの検索をこのあたりに寄せる（伴北六丁目の中心。OpenStreetMap で調べた） */
  near: { lat: 34.482223, lon: 132.396193 },
};

const q = encodeURIComponent(VENUE.name);

/** Apple マップ（iPhone・Mac ではアプリ、ほかはブラウザの Apple マップ） */
export function appleMapsUrl() {
  // 名前と住所で探す（point はだいたいの位置なので、検索をその近くに寄せるのにだけ使う）
  const near = VENUE.point ?? VENUE.near;
  return `https://maps.apple.com/?q=${q}&address=${encodeURIComponent(VENUE.address)}&sll=${near.lat},${near.lon}`;
}

/** Google マップ */
export function googleMapsUrl() {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${VENUE.name} ${VENUE.address}`)}`;
}

/** 埋め込みの地図（OpenStreetMap。鍵もお金もいらない）。位置が未確認なら null */
export function embedMapUrl() {
  const p = VENUE.point;
  if (!p) return null;
  const d = 0.006;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${p.lon - d},${p.lat - d * 0.75},${p.lon + d},${p.lat + d * 0.75}&layer=mapnik&marker=${p.lat},${p.lon}`;
}
