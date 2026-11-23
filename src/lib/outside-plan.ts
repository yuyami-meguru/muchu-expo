import { areaOf, OUTSIDE, type Place, type PlaceKind } from "./types";

/*
 * 外の地図（会場マップ）。パンフレット 2 ページ目の会場マップ（実行委員の配置図を清書したもの）と同じ配置・同じ色分け。
 * 座標はパンフで決めた単位で、OUT_VIEW の四角の中（左上が x・y）。地図の上のピンの位置（Place の x・y）は、この四角の中の割合（0〜100）。
 * パンフを作り直すときは .work/pamph/build.mjs の mapSvg() も同じ値（2 つをそろえる）
 */
export const OUT_VIEW = { x: 66, y: 118, w: 1012, h: 846 } as const;

/** 箱の色分け（パンフの凡例：お店・出し物／休憩／建物／知育館・門・駐車場・バス停。そのほかの建物・カフェ・受付・藤棚） */
export type OutKind = "booth" | "rest" | "bldg" | "other" | "cafe" | "key" | "recv" | "fuji";
export type OutBox = {
  /** 枠の id（会場マップの場所 OUT_PLACES の boxes で使う） */
  id: string;
  k: OutKind;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** 箱の中の名前（\n で改行） */
  label: string;
  /** 名前の大きさ（パンフの単位。無ければ 19） */
  size?: number;
  rx?: number;
  /** 点線の枠（バス停） */
  dash?: boolean;
  /** 名前の下に小さく添える字（大食堂の「体験・休憩」） */
  sub?: string;
  /** 名前を箱の真ん中からずらす */
  dx?: number;
  dy?: number;
  /** 建物の名前（フロアの「建物の名前」と同じなら、お客さんの地図で押すとその建物の中の地図へ） */
  building?: string;
};

export const OUT_BOXES: readonly OutBox[] = [
  { id: "seikatsu", k: "bldg", x1: 160, y1: 219, x2: 685, y2: 280, label: "生活棟（A）", dx: -20 },
  { id: "iriguchi", k: "other", x1: 688, y1: 240, x2: 760, y2: 280, label: "入口", size: 15 },
  // v0.17.0（2026-11-20）：体験が知育館の前から大食堂の中に変わった（ユーザー）。大食堂で体験・休憩ができるので、
  // お店・出し物の色にして「体験・休憩」を添える（知育館の前の「体験」の箱は消した）
  { id: "shokudo", k: "booth", x1: 763, y1: 219, x2: 936, y2: 280, label: "大食堂", sub: "体験・休憩" },
  { id: "yakisoba", k: "booth", x1: 305, y1: 286, x2: 490, y2: 343, label: "焼きそば", size: 20 },
  { id: "marche", k: "booth", x1: 571, y1: 287, x2: 724, y2: 345, label: "エンカレ\nマルシェ", size: 18 },
  { id: "cafe", k: "cafe", x1: 763, y1: 303, x2: 872, y2: 340, label: "カフェ", size: 17 },
  { id: "craft", k: "other", x1: 948, y1: 265, x2: 1050, y2: 385, label: "クラフト\nセンター・\n音楽室", size: 15 },
  // v0.21.0（2026-11-20 ユーザー）：クラフトセンターの下の道に、端に寄せてテントが増えた（道の線の左・藤棚との間に縦長 1 つ）。
  // 地域部門（地域のつくり手を紹介）のテント。パンフの会場マップ（build.mjs の mapSvg）にも同じ位置で入っている
  { id: "tent-craft", k: "booth", x1: 910, y1: 398, x2: 950, y2: 528, label: "テ\nン\nト", size: 15 },
  { id: "shoshokudo", k: "bldg", x1: 82, y1: 354, x2: 188, y2: 555, label: "小食堂" },
  { id: "chaya", k: "booth", x1: 197, y1: 356, x2: 286, y2: 538, label: "茶屋", size: 22 },
  { id: "rest-w", k: "rest", x1: 317, y1: 420, x2: 392, y2: 535, label: "休憩" },
  { id: "rest-n", k: "rest", x1: 398, y1: 358, x2: 517, y2: 415, label: "休憩" },
  { id: "rest-e", k: "rest", x1: 520, y1: 420, x2: 595, y2: 533, label: "休憩" },
  { id: "recv", k: "recv", x1: 398, y1: 540, x2: 517, y2: 597, label: "受付", size: 21 },
  { id: "fuji", k: "fuji", x1: 640, y1: 418, x2: 903, y2: 520, label: "藤棚", rx: 24, size: 22 },
  { id: "tokuiku", k: "bldg", x1: 82, y1: 636, x2: 188, y2: 712, label: "徳育館" },
  { id: "taiiku", k: "bldg", x1: 82, y1: 720, x2: 188, y2: 797, label: "体育館", dy: 8 },
  { id: "parking", k: "key", x1: 82, y1: 806, x2: 188, y2: 878, label: "駐車場" },
  { id: "chiiku", k: "key", x1: 727, y1: 632, x2: 932, y2: 717, label: "知育館", dx: -26, dy: -12, size: 21, building: "知育館" },
  { id: "bus", k: "key", x1: 628, y1: 738, x2: 719, y2: 797, label: "バス停", rx: 12, dash: true, size: 17 },
  { id: "gate", k: "key", x1: 465, y1: 897, x2: 575, y2: 945, label: "正門", size: 20 },
];

/** 道（元の配置図の灰色の線）。w は線の太さ（無ければ 4） */
export const OUT_ROADS: readonly { d: string; w?: number }[] = [
  { d: "M513 632 L555 805 L755 805" },
  { d: "M513 632 L705 632 L688 718 L983 718" },
  { d: "M576 843 L748 843" },
  { d: "M571 845 L586 905" },
  { d: "M258 912 L432 835 L450 912" },
  { d: "M953 630 L1038 630" },
  { d: "M955 410 Q 972 548 1068 566" },
  { d: "M188 555 L188 806", w: 2.2 },
];
/** 木のあるところ（形と、木のドット絵の左上。木の幅は size） */
export const OUT_TREES = { area: "M266 650 L384 650 L422 805 L255 880 Z", at: [[280, 664], [330, 712], [276, 770]] as const, size: 46 };
export const OUT_FIRE = { cx: 458, cy: 477, r: 58, label: "ファイヤー\nサークル", size: 15 };
/** トイレの印（左上。幅 40・高さ 30 の札。s は大きさ） */
export const OUT_WC: readonly { x: number; y: number; s?: number }[] = [{ x: 636, y: 235 }, { x: 146, y: 724, s: 0.9 }, { x: 880, y: 646 }];
/** バス停のドット絵（左上と幅） */
export const OUT_BUS = { x: 590, y: 745, w: 24 };
/** 箱の外の書きこみ（大食堂の上。引き出し線つき） */
export const OUT_NOTE = { label: "大食堂および\nトイレのみ開放", x: 726, y: 156, size: 14, line: "M752 184 L788 224" };

/** 会場マップに描いてある建物（中のフロアへ移れる）と、正門があるか。実行委員の画面で「建物・正門のピンが無い」と言わないため */
export const OUT_BUILDINGS = new Set(OUT_BOXES.flatMap((b) => (b.building ? [b.building] : [])));
export const OUT_HAS_GATE = OUT_BOXES.some((b) => b.label === "正門");

/** 枠の形（パンフの単位）：箱のほか、トイレの印（wc-1〜3）とファイヤーサークル（fire）も押せる枠にする */
const OUT_SHAPES: Record<string, { x1: number; y1: number; x2: number; y2: number }> = {
  ...Object.fromEntries(OUT_BOXES.map((b) => [b.id, { x1: b.x1, y1: b.y1, x2: b.x2, y2: b.y2 }])),
  ...Object.fromEntries(OUT_WC.map((t, i) => [`wc-${i + 1}`, { x1: t.x, y1: t.y, x2: t.x + 40 * (t.s ?? 1), y2: t.y + 30 * (t.s ?? 1) }])),
  fire: { x1: OUT_FIRE.cx - OUT_FIRE.r, y1: OUT_FIRE.cy - OUT_FIRE.r, x2: OUT_FIRE.cx + OUT_FIRE.r, y2: OUT_FIRE.cy + OUT_FIRE.r },
};
const pct = (v: number, o: number, w: number) => Math.round(((v - o) / w) * 10000) / 100;

/** 枠の、地図の上の位置（割合。x・y は真ん中、w・h は幅と高さ）。知らない枠は null */
export function outBoxRect(id: string): { x: number; y: number; w: number; h: number } | null {
  const s = OUT_SHAPES[id];
  if (!s) return null;
  const w = pct(s.x2, 0, OUT_VIEW.w) - pct(s.x1, 0, OUT_VIEW.w);
  const h = pct(s.y2, 0, OUT_VIEW.h) - pct(s.y1, 0, OUT_VIEW.h);
  return { x: pct((s.x1 + s.x2) / 2, OUT_VIEW.x, OUT_VIEW.w), y: pct((s.y1 + s.y2) / 2, OUT_VIEW.y, OUT_VIEW.h), w, h };
}

/**
 * 会場マップの場所（v0.17.0。ユーザー「マップに書いてある場所に合わせたい」「受付なども全部」）。
 * 地図に描いてある枠が、そのまま場所になる：お店の「場所」で選べて、地図で押すとそこの案内が出る（ピンを置かなくてよい）。
 * Redis には入れない決まった場所で、store.ts の siteData が保存してある場所に足す。実行委員は動かせない・消せない（API も断る）。
 * 配置が変わったら、ここと OUT_BOXES（とパンフの mapSvg）を直す。id は「out-」で始める（実行委員が作るピンには使えない）
 */
const MAP_PLACES: { id: string; name: string; kind: PlaceKind; boxes: string[]; note?: string }[] = [
  { id: "out-shokudo", name: "大食堂", kind: "spot", boxes: ["shokudo"], note: "体験・休憩ができます" },
  { id: "out-yakisoba", name: "焼きそば", kind: "spot", boxes: ["yakisoba"] },
  { id: "out-marche", name: "エンカレマルシェ", kind: "spot", boxes: ["marche"] },
  { id: "out-cafe", name: "カフェ", kind: "spot", boxes: ["cafe"] },
  { id: "out-chaya", name: "茶屋", kind: "spot", boxes: ["chaya"] },
  { id: "out-tent-craft", name: "テント（クラフトセンターの下）", kind: "spot", boxes: ["tent-craft"] },
  { id: "out-fire", name: "ファイヤーサークル", kind: "spot", boxes: ["fire"] },
  { id: "out-fuji", name: "藤棚", kind: "spot", boxes: ["fuji"] },
  { id: "out-recv", name: "受付", kind: "info", boxes: ["recv"] },
  { id: "out-rest", name: "休憩所", kind: "rest", boxes: ["rest-w", "rest-n", "rest-e"], note: "ファイヤーサークルのまわりの 3 か所（大食堂の中でも休憩できます）" },
  { id: "out-wc", name: "トイレ", kind: "toilet", boxes: ["wc-1", "wc-2", "wc-3"], note: "生活棟・体育館・知育館の 3 か所（知育館は各階にあります）" },
  { id: "out-gate", name: "正門", kind: "gate", boxes: ["gate"] },
  { id: "out-bus", name: "バス停", kind: "bus", boxes: ["bus"] },
  { id: "out-parking", name: "駐車場", kind: "parking", boxes: ["parking"] },
];

/** 会場マップの場所（Place の形。x・y は 1 つ目の枠の真ん中） */
export const OUT_PLACES: readonly Place[] = MAP_PLACES.map((p) => {
  const r = outBoxRect(p.boxes[0]);
  return { id: p.id, name: p.name, kind: p.kind, boxes: p.boxes, note: p.note ?? "", x: r?.x ?? 50, y: r?.y ?? 50 };
});
const MAP_PLACE_IDS = new Set(OUT_PLACES.map((p) => p.id));
/** 会場マップの場所か（実行委員が作る・直す・消すピンではない） */
export const isMapPlace = (p: Pick<Place, "boxes">) => !!p.boxes?.length;
/** 会場マップの場所の id か、それに使う「out-」で始まる id か（実行委員のピンの id には使わせない） */
export const isMapPlaceId = (id: string) => MAP_PLACE_IDS.has(id) || id.startsWith("out-");

/** パンフの単位の点 → 地図の上の割合（ピンの x・y） */
const at = (ux: number, uy: number) => [Math.round(((ux - OUT_VIEW.x) / OUT_VIEW.w) * 10000) / 100, Math.round(((uy - OUT_VIEW.y) / OUT_VIEW.h) * 10000) / 100] as const;

/**
 * v0.14.0 で外の地図を会場マップに替えた。それまでの外のピンは、前の地図（OpenStreetMap の建物の形）の上の位置。
 * はじめの仮の位置（seed）のままのピンは、会場マップの上の位置に読みかえて見せる（保存してあるデータは書きかえない）。
 * to が無いもの（会場マップに無い・場所が決まっていない）は、お客さんの地図には出さない。
 * 実行委員がピンを動かしたら（保存した位置が from と違えば）、その位置をそのまま使う。
 * to は、ピンの頭が箱の右の方に入り、箱の名前に重ならない所（ピンの先が箱の下の辺）
 */
const LEGACY_OUTSIDE: Record<string, { from: readonly [number, number]; to?: readonly [number, number] }> = {
  "tent-food": { from: [48, 62], to: at(466, 343) }, // 焼きそば（v0.17.0 で会場マップの「焼きそば」の場所に移し、この仮のピンは消す）
  "tent-chiiku": { from: [72, 30] }, // 体験（知育館のそば）→ v0.17.0 で大食堂の中へ。この仮のピンは store.ts で 1 度だけ消す
  classroom: { from: [24, 36] }, // 校舎の教室（会場マップに無い）
  radio: { from: [36, 74] }, // 放送ブース（場所は決まりしだい）
};

/** 外のピンの、会場マップの上の位置。まだ置き直していない（地図に出さない）ピンは null。フロアのピン・会場マップの場所はそのまま */
export function outsideSpot(p: Pick<Place, "id" | "x" | "y" | "area" | "boxes">): { x: number; y: number } | null {
  if (areaOf(p) !== OUTSIDE || isMapPlace(p)) return { x: p.x, y: p.y };
  const l = LEGACY_OUTSIDE[p.id];
  if (!l || p.x !== l.from[0] || p.y !== l.from[1]) return { x: p.x, y: p.y };
  return l.to ? { x: l.to[0], y: l.to[1] } : null;
}
