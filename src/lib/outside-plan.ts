import { areaOf, OUTSIDE, type Place } from "./types";

/*
 * 外の地図（会場マップ）。パンフレット 2 ページ目の会場マップ（実行委員の配置図を清書したもの）と同じ配置・同じ色分け。
 * 座標はパンフで決めた単位で、OUT_VIEW の四角の中（左上が x・y）。地図の上のピンの位置（Place の x・y）は、この四角の中の割合（0〜100）。
 * パンフを作り直すときは .work/pamph/build.mjs の mapSvg() も同じ値（2 つをそろえる）
 */
export const OUT_VIEW = { x: 66, y: 118, w: 1012, h: 846 } as const;

/** 箱の色分け（パンフの凡例：お店・出し物／休憩／建物／知育館・門・駐車場・バス停。そのほかの建物・カフェ・受付・藤棚） */
export type OutKind = "booth" | "rest" | "bldg" | "other" | "cafe" | "key" | "recv" | "fuji";
export type OutBox = {
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
  /** 名前を箱の真ん中からずらす */
  dx?: number;
  dy?: number;
  /** 建物の名前（フロアの「建物の名前」と同じなら、お客さんの地図で押すとその建物の中の地図へ） */
  building?: string;
};

export const OUT_BOXES: readonly OutBox[] = [
  { k: "bldg", x1: 160, y1: 219, x2: 685, y2: 280, label: "生活棟（A）", dx: -20 },
  { k: "other", x1: 688, y1: 240, x2: 760, y2: 280, label: "入口", size: 15 },
  { k: "other", x1: 763, y1: 219, x2: 936, y2: 280, label: "大食堂" },
  { k: "booth", x1: 305, y1: 286, x2: 490, y2: 343, label: "焼きそば", size: 20 },
  { k: "booth", x1: 571, y1: 287, x2: 724, y2: 345, label: "エンカレ\nマルシェ", size: 18 },
  { k: "cafe", x1: 763, y1: 303, x2: 872, y2: 340, label: "カフェ", size: 17 },
  { k: "other", x1: 948, y1: 265, x2: 1050, y2: 385, label: "クラフト\nセンター・\n音楽室", size: 15 },
  { k: "bldg", x1: 82, y1: 354, x2: 188, y2: 555, label: "小食堂" },
  { k: "booth", x1: 197, y1: 356, x2: 286, y2: 538, label: "茶屋", size: 22 },
  { k: "rest", x1: 317, y1: 420, x2: 392, y2: 535, label: "休憩" },
  { k: "rest", x1: 398, y1: 358, x2: 517, y2: 415, label: "休憩" },
  { k: "rest", x1: 520, y1: 420, x2: 595, y2: 533, label: "休憩" },
  { k: "recv", x1: 398, y1: 540, x2: 517, y2: 597, label: "受付", size: 21 },
  { k: "fuji", x1: 640, y1: 418, x2: 903, y2: 520, label: "藤棚", rx: 24, size: 22 },
  { k: "booth", x1: 596, y1: 561, x2: 736, y2: 630, label: "体験", size: 20 },
  { k: "bldg", x1: 82, y1: 636, x2: 188, y2: 712, label: "徳育館" },
  { k: "bldg", x1: 82, y1: 720, x2: 188, y2: 797, label: "体育館", dy: 8 },
  { k: "key", x1: 82, y1: 806, x2: 188, y2: 878, label: "駐車場" },
  { k: "key", x1: 727, y1: 632, x2: 932, y2: 717, label: "知育館", dx: -26, dy: -12, size: 21, building: "知育館" },
  { k: "key", x1: 628, y1: 738, x2: 719, y2: 797, label: "バス停", rx: 12, dash: true, size: 17 },
  { k: "key", x1: 465, y1: 897, x2: 575, y2: 945, label: "正門", size: 20 },
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
  "tent-food": { from: [48, 62], to: at(466, 343) }, // 焼きそば
  "tent-chiiku": { from: [72, 30], to: at(714, 630) }, // 体験（知育館のそば）
  classroom: { from: [24, 36] }, // 校舎の教室（会場マップに無い）
  radio: { from: [36, 74] }, // 放送ブース（場所は決まりしだい）
};

/** 外のピンの、会場マップの上の位置。まだ置き直していない（地図に出さない）ピンは null。フロアのピンはそのまま */
export function outsideSpot(p: Pick<Place, "id" | "x" | "y" | "area">): { x: number; y: number } | null {
  if (areaOf(p) !== OUTSIDE) return { x: p.x, y: p.y };
  const l = LEGACY_OUTSIDE[p.id];
  if (!l || p.x !== l.from[0] || p.y !== l.from[1]) return { x: p.x, y: p.y };
  return l.to ? { x: l.to[0], y: l.to[1] } : null;
}
