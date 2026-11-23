import { areaOf, OUTSIDE, PLACE_KINDS, type Place, type PlaceKind } from "./types";

/*
 * 外の地図（会場マップ）。はじめの配置（DEFAULT_LAYOUT）は、パンフレット 2 ページ目の会場マップ（実行委員の配置図を清書したもの）と同じ。
 * v0.22.0 から、枠（大食堂・テント・休憩・受付など）は実行委員が「地図のピン」の画面でドラッグして動かせる・足せる・消せる
 * （配置は Redis の muchu:omap に保存。保存が無ければ DEFAULT_LAYOUT）。道・木の絵は動かない背景。
 * パンフは印刷物なので、配置を変えても自動ではそろわない（パンフを作り直すときは .work/pamph/build.mjs の mapSvg() を直す）。
 * 座標はパンフで決めた単位で、OUT_VIEW の四角の中（左上が x・y）。地図の上のピンの位置（Place の x・y）は、この四角の中の割合（0〜100）。
 */
export const OUT_VIEW = { x: 66, y: 118, w: 1012, h: 846 } as const;

/** 枠の色分け（パンフの凡例：お店・出し物／休憩／建物／知育館・門・駐車場・バス停。そのほかの建物・カフェ・受付・藤棚・ファイヤーサークル） */
export type OutKind = "booth" | "rest" | "bldg" | "other" | "cafe" | "key" | "recv" | "fuji" | "fire";
export const OUT_KINDS: readonly { value: OutKind; label: string }[] = [
  { value: "booth", label: "お店・出し物（白に紺の枠）" },
  { value: "rest", label: "休憩（うすい緑）" },
  { value: "bldg", label: "建物（うすい赤）" },
  { value: "key", label: "知育館・門・駐車場・バス停（黄色）" },
  { value: "other", label: "そのほかの建物（白に灰色の枠）" },
  { value: "cafe", label: "カフェ（うすい青）" },
  { value: "recv", label: "受付（白に紫の枠）" },
  { value: "fuji", label: "藤棚（緑）" },
  { value: "fire", label: "ファイヤーサークル（だいだい）" },
];

/** 枠の形：四角・丸（ファイヤーサークル）・トイレの印・バス停の標識・字だけ（書きこみ） */
export type OutShape = "rect" | "round" | "wc" | "busstop" | "text";
export const OUT_SHAPES: readonly { value: OutShape; label: string }[] = [
  { value: "rect", label: "四角" },
  { value: "round", label: "丸" },
  { value: "wc", label: "トイレの印" },
  { value: "busstop", label: "バス停の標識" },
  { value: "text", label: "字だけ（書きこみ）" },
];

/** 押したときの場所（お客さんの地図で押せる・お店の「場所」で選べる）。id が同じ枠は 1 つの場所（休憩所 3 か所など）。id は「out-」で始める */
export type OutPlace = { id: string; kind: PlaceKind; name: string; note: string };

/** 会場マップの枠 1 つ。座標はパンフの単位（左上 x1・y1、右下 x2・y2）。描く順は並びの順（あとの物が上） */
export type OutItem = {
  id: string;
  k: OutKind;
  shape?: OutShape;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** 枠の中の名前（\n で改行） */
  label: string;
  /** 名前の下に小さく添える字（大食堂の「体験・休憩」） */
  sub?: string;
  /** 名前の大きさ（パンフの単位。無ければ 19） */
  size?: number;
  rx?: number;
  /** 点線の枠（バス停） */
  dash?: boolean;
  /** 名前を枠の真ん中からずらす */
  dx?: number;
  dy?: number;
  /** 建物の名前（フロアの「建物の名前」と同じなら、お客さんの地図で押すとその建物の中の地図へ） */
  building?: string;
  /** 押したときの場所（無ければ押せない絵） */
  place?: OutPlace;
};
export type OutLayout = { items: OutItem[] };

const P = (id: string, name: string, kind: PlaceKind = "spot", note = ""): OutPlace => ({ id, kind, name, note });
const REST = P("out-rest", "休憩所", "rest", "ファイヤーサークルのまわりの 3 か所（大食堂の中でも休憩できます）");
const WC = P("out-wc", "トイレ", "toilet", "生活棟・体育館・知育館の 3 か所（知育館は各階にあります）");

/**
 * はじめの配置（2026-11-20 時点のパンフの会場マップと同じ）。体験は知育館の前から大食堂の中に変わった（v0.17.0）。
 * 場所の id（out-shokudo など）は、お店の場所（placeId）に使われているので変えない
 */
export const DEFAULT_LAYOUT: OutLayout = {
  items: [
    { id: "note", k: "other", shape: "text", x1: 664, y1: 134, x2: 788, y2: 178, label: "大食堂および\nトイレのみ開放", size: 14 },
    { id: "seikatsu", k: "bldg", x1: 160, y1: 219, x2: 685, y2: 280, label: "生活棟（A）", dx: -20 },
    { id: "wc-1", k: "other", shape: "wc", x1: 636, y1: 235, x2: 676, y2: 265, label: "", place: WC },
    { id: "iriguchi", k: "other", x1: 688, y1: 240, x2: 760, y2: 280, label: "入口", size: 15 },
    { id: "shokudo", k: "booth", x1: 763, y1: 219, x2: 936, y2: 280, label: "大食堂", sub: "体験・休憩", place: P("out-shokudo", "大食堂", "spot", "体験・休憩ができます") },
    { id: "yakisoba", k: "booth", x1: 305, y1: 286, x2: 490, y2: 343, label: "焼きそば", size: 20, place: P("out-yakisoba", "焼きそば") },
    { id: "marche", k: "booth", x1: 571, y1: 287, x2: 724, y2: 345, label: "エンカレ\nマルシェ", size: 18, place: P("out-marche", "エンカレマルシェ") },
    { id: "cafe", k: "cafe", x1: 763, y1: 303, x2: 872, y2: 340, label: "カフェ", size: 17, place: P("out-cafe", "カフェ") },
    { id: "craft", k: "other", x1: 948, y1: 265, x2: 1050, y2: 385, label: "クラフト\nセンター・\n音楽室", size: 15 },
    // 2026-11-20：クラフトセンターの下の道に、端に寄せてテントが増えた（ユーザー。道の線の左・藤棚との間に縦長 1 つ）
    { id: "tent-craft", k: "booth", x1: 910, y1: 398, x2: 950, y2: 528, label: "テ\nン\nト", size: 15, place: P("out-tent-craft", "テント（クラフトセンターの下）") },
    { id: "shoshokudo", k: "bldg", x1: 82, y1: 354, x2: 188, y2: 555, label: "小食堂" },
    { id: "chaya", k: "booth", x1: 197, y1: 356, x2: 286, y2: 538, label: "茶屋", size: 22, place: P("out-chaya", "茶屋") },
    { id: "rest-w", k: "rest", x1: 317, y1: 420, x2: 392, y2: 535, label: "休憩", place: REST },
    { id: "rest-n", k: "rest", x1: 398, y1: 358, x2: 517, y2: 415, label: "休憩", place: REST },
    { id: "rest-e", k: "rest", x1: 520, y1: 420, x2: 595, y2: 533, label: "休憩", place: REST },
    { id: "fire", k: "fire", shape: "round", x1: 400, y1: 419, x2: 516, y2: 535, label: "ファイヤー\nサークル", size: 15, place: P("out-fire", "ファイヤーサークル") },
    { id: "recv", k: "recv", x1: 398, y1: 540, x2: 517, y2: 597, label: "受付", size: 21, place: P("out-recv", "受付", "info") },
    { id: "fuji", k: "fuji", x1: 640, y1: 418, x2: 903, y2: 520, label: "藤棚", rx: 24, size: 22, place: P("out-fuji", "藤棚") },
    { id: "tokuiku", k: "bldg", x1: 82, y1: 636, x2: 188, y2: 712, label: "徳育館" },
    { id: "taiiku", k: "bldg", x1: 82, y1: 720, x2: 188, y2: 797, label: "体育館", dy: 8 },
    { id: "wc-2", k: "other", shape: "wc", x1: 146, y1: 724, x2: 182, y2: 751, label: "", place: WC },
    { id: "parking", k: "key", x1: 82, y1: 806, x2: 188, y2: 878, label: "駐車場", place: P("out-parking", "駐車場", "parking") },
    { id: "chiiku", k: "key", x1: 727, y1: 632, x2: 932, y2: 717, label: "知育館", dx: -26, dy: -12, size: 21, building: "知育館" },
    { id: "wc-3", k: "other", shape: "wc", x1: 880, y1: 646, x2: 920, y2: 676, label: "", place: WC },
    { id: "bus-sign", k: "key", shape: "busstop", x1: 590, y1: 745, x2: 614, y2: 793, label: "" },
    { id: "bus", k: "key", x1: 628, y1: 738, x2: 719, y2: 797, label: "バス停", rx: 12, dash: true, size: 17, place: P("out-bus", "バス停", "bus") },
    { id: "gate", k: "key", x1: 465, y1: 897, x2: 575, y2: 945, label: "正門", size: 20, place: P("out-gate", "正門", "gate") },
  ],
};

/** 道（元の配置図の灰色の線。動かない背景）。w は線の太さ（無ければ 4） */
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
/** 木のあるところ（形と、木のドット絵の左上。木の幅は size。動かない背景） */
export const OUT_TREES = { area: "M266 650 L384 650 L422 805 L255 880 Z", at: [[280, 664], [330, 712], [276, 770]] as const, size: 46 };

/* ───── 配置の読み取り（保存してある JSON を確かめる。おかしな枠は捨てる） ───── */
const KIND_SET = new Set<string>([
  "booth",
  "rest",
  "bldg",
  "other",
  "cafe",
  "key",
  "recv",
  "fuji",
  "fire",
] satisfies OutKind[]);
const SHAPE_SET = new Set<string>(["rect", "round", "wc", "busstop", "text"] satisfies OutShape[]);
const PLACE_KIND_SET = new Set<string>(PLACE_KINDS.map((k) => k.value));
/** 枠の id・場所の id に使える字 */
export const OUT_ITEM_ID = /^[a-z0-9-]{1,40}$/;
export const OUT_PLACE_ID = /^out-[a-z0-9-]{1,36}$/;
/** 座標が使える範囲（地図の四角の少し外まで） */
export const OUT_MIN = { x: OUT_VIEW.x - 40, y: OUT_VIEW.y - 40 };
export const OUT_MAX = { x: OUT_VIEW.x + OUT_VIEW.w + 40, y: OUT_VIEW.y + OUT_VIEW.h + 40 };
export const OUT_MAX_ITEMS = 120;

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const text = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

/** 保存してある配置（JSON の文字か、読んだ物）を読む。読めなければ null（はじめの配置を使う） */
export function parseLayout(v: unknown): OutLayout | null {
  let o: unknown = v;
  if (typeof v === "string") {
    try {
      o = JSON.parse(v);
    } catch {
      return null;
    }
  }
  if (!o || typeof o !== "object" || !Array.isArray((o as { items?: unknown }).items)) return null;
  const seen = new Set<string>();
  const items: OutItem[] = [];
  for (const raw of (o as { items: unknown[] }).items.slice(0, OUT_MAX_ITEMS)) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const id = text(r.id, 40);
    const [x1, y1, x2, y2] = [num(r.x1), num(r.y1), num(r.x2), num(r.y2)];
    if (!OUT_ITEM_ID.test(id) || seen.has(id) || x1 === null || y1 === null || x2 === null || y2 === null || x2 <= x1 || y2 <= y1) continue;
    seen.add(id);
    const it: OutItem = { id, k: KIND_SET.has(String(r.k)) ? (r.k as OutKind) : "other", x1, y1, x2, y2, label: text(r.label, 40) };
    if (SHAPE_SET.has(String(r.shape)) && r.shape !== "rect") it.shape = r.shape as OutShape;
    if (text(r.sub, 20)) it.sub = text(r.sub, 20);
    for (const key of ["size", "rx", "dx", "dy"] as const) {
      const n = num(r[key]);
      if (n !== null) it[key] = n;
    }
    if (r.dash === true) it.dash = true;
    if (text(r.building, 20)) it.building = text(r.building, 20);
    const pl = r.place as Record<string, unknown> | undefined;
    if (pl && typeof pl === "object" && OUT_PLACE_ID.test(text(pl.id, 40)) && text(pl.name, 30)) {
      it.place = {
        id: text(pl.id, 40),
        kind: PLACE_KIND_SET.has(String(pl.kind)) ? (pl.kind as PlaceKind) : "spot",
        name: text(pl.name, 30),
        note: text(pl.note, 60),
      };
    }
    items.push(it);
  }
  return { items };
}

const pct = (v: number, o: number, w: number) => Math.round(((v - o) / w) * 10000) / 100;
/** 枠の、地図の上の位置（割合。x・y は真ん中、w・h は幅と高さ）。知らない枠は null */
export function itemRect(layout: OutLayout, id: string): { x: number; y: number; w: number; h: number } | null {
  const s = layout.items.find((i) => i.id === id);
  if (!s) return null;
  return {
    x: pct((s.x1 + s.x2) / 2, OUT_VIEW.x, OUT_VIEW.w),
    y: pct((s.y1 + s.y2) / 2, OUT_VIEW.y, OUT_VIEW.h),
    w: Math.round(((s.x2 - s.x1) / OUT_VIEW.w) * 10000) / 100,
    h: Math.round(((s.y2 - s.y1) / OUT_VIEW.h) * 10000) / 100,
  };
}

/**
 * 配置から作る「会場マップの場所」（Place の形。boxes はその場所の枠の id。x・y は 1 つ目の枠の真ん中）。
 * 同じ場所の id の枠は 1 つの場所にまとめる（名前・種類・ひとことは、並びで最初の枠の物）。store.ts の siteData が保存した場所に足す
 */
export function layoutPlaces(layout: OutLayout): Place[] {
  const by = new Map<string, Place>();
  for (const it of layout.items) {
    if (!it.place) continue;
    const had = by.get(it.place.id);
    if (had) {
      had.boxes!.push(it.id);
      continue;
    }
    const r = itemRect(layout, it.id);
    by.set(it.place.id, { id: it.place.id, name: it.place.name, kind: it.place.kind, note: it.place.note, boxes: [it.id], x: r?.x ?? 50, y: r?.y ?? 50 });
  }
  return [...by.values()];
}

/** 会場マップに描いてある建物（中のフロアへ移れる）と、正門があるか。実行委員の画面で「建物・正門のピンが無い」と言わないため */
export const outBuildings = (layout: OutLayout) => new Set(layout.items.flatMap((i) => (i.building ? [i.building] : [])));
export const outHasGate = (layout: OutLayout) => layout.items.some((i) => i.place?.kind === "gate" || i.label === "正門");

/** 会場マップの場所か（実行委員が「地図のピン」で作る・直す・消すピンではない。配置の画面で直す） */
export const isMapPlace = (p: Pick<Place, "boxes">) => !!p.boxes?.length;
/** 会場マップの場所に使う「out-」で始まる id か（実行委員のピンの id には使わせない） */
export const isMapPlaceId = (id: string) => id.startsWith("out-");

/** パンフの単位の点 → 地図の上の割合（ピンの x・y） */
const at = (ux: number, uy: number) => [pct(ux, OUT_VIEW.x, OUT_VIEW.w), pct(uy, OUT_VIEW.y, OUT_VIEW.h)] as const;

/**
 * v0.14.0 で外の地図を会場マップに替えた。それまでの外のピンは、前の地図（OpenStreetMap の建物の形）の上の位置。
 * はじめの仮の位置（seed）のままのピンは、会場マップの上の位置に読みかえて見せる（保存してあるデータは書きかえない）。
 * to が無いもの（会場マップに無い・場所が決まっていない）は、お客さんの地図には出さない。
 * 実行委員がピンを動かしたら（保存した位置が from と違えば）、その位置をそのまま使う
 */
const LEGACY_OUTSIDE: Record<string, { from: readonly [number, number]; to?: readonly [number, number] }> = {
  "tent-food": { from: [48, 62], to: at(466, 343) }, // 焼きそば（v0.17.0 で会場マップの「焼きそば」の場所に移し、この仮のピンは消した）
  "tent-chiiku": { from: [72, 30] }, // 体験（知育館のそば）→ v0.17.0 で大食堂の中へ。この仮のピンは消した
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
