// 夢中万博のデータの形。保存先（Upstash Redis）にはこの形の JSON をそのまま入れる。

/** 部門の色（色見本から選ぶ。CSS の .tone-○○ と同じ名前） */
export type Tone = "blue" | "orange" | "red" | "purple" | "green" | "teal" | "pink" | "brown";
export const TONES: { value: Tone; label: string }[] = [
  { value: "blue", label: "青" },
  { value: "orange", label: "オレンジ" },
  { value: "red", label: "赤" },
  { value: "purple", label: "紫" },
  { value: "green", label: "緑" },
  { value: "teal", label: "青緑" },
  { value: "pink", label: "ピンク" },
  { value: "brown", label: "茶" },
];

/** 部門。実行委員の画面で足す・消す・名前や色を変えられる */
export type Dept = {
  id: string;
  /** 「体験部門」 */
  name: string;
  /** カードや地図に出す短い名前（「体験」） */
  short: string;
  /** ひとこと（「遊んで、つくって、持って帰れる」） */
  tagline: string;
  color: Tone;
  order: number;
};

/** 品物の残り：販売中・残りわずか・売り切れ */
export type Stock = "on" | "few" | "out";

/** お店の状態：準備中・営業中・休憩中・終了 */
export type ShopState = "prep" | "open" | "break" | "closed";

/** 「何したい？」の絞り込み */
export type Kind = "eat" | "play" | "see";

export type MenuItem = {
  id: string;
  name: string;
  /** 「400円前後」「無料」など。決まっていなければ空 */
  price: string;
  note: string;
  stock: Stock;
};

/** 当日の流れ（AVERIX の「ご利用の流れ」の形で出す） */
export type ScheduleItem = { time: string; text: string };

export type Shop = {
  id: string;
  /** 部門の id（Dept.id）。部門が消えていたら「未分類」として出す */
  dept: string;
  kind: Kind;
  name: string;
  /** 一言（カードに出す） */
  catch: string;
  /** くわしい説明 */
  description: string;
  /** お店の人の思い */
  message: string;
  /** 場所（地図のピン）。未定なら空 */
  placeId: string;
  /** 場所の補足（「201 または 303 号室（予定）」など） */
  placeNote: string;
  menu: MenuItem[];
  schedule: ScheduleItem[];
  state: ShopState;
  /** お店からのお知らせ（「13時から焼き直し中」など） */
  notice: string;
  /** 一覧に出さない（準備ができるまで隠す） */
  hidden: boolean;
  /** 並べる順 */
  order: number;
  updatedAt: number;
};

/** 地図のピン。x・y は地図の左上からの割合（0〜100） */
export type Place = { id: string; name: string; x: number; y: number; note: string };

/** 実行委員からのお知らせ（トップに出す） */
export type News = { id: string; text: string; at: number; pinned: boolean };

export type SiteData = { depts: Dept[]; shops: Shop[]; places: Place[]; news: News[] };

/** 部門が見つからないとき（消した部門のお店など） */
export const NO_DEPT: Dept = { id: "", name: "未分類", short: "未分類", tagline: "", color: "brown", order: 9999 };

/** 部門を id で引く道具 */
export function deptLookup(depts: Dept[]) {
  const m = new Map(depts.map((d) => [d.id, d]));
  return (id: string) => m.get(id) ?? NO_DEPT;
}

export const STOCK_LABEL: Record<Stock, string> = { on: "販売中", few: "残りわずか", out: "売り切れ" };
export const STATE_LABEL: Record<ShopState, string> = { prep: "準備中", open: "営業中", break: "休憩中", closed: "終了" };
export const KIND_LABEL: Record<Kind, string> = { eat: "食べる・飲む", play: "遊ぶ・つくる", see: "見る・聴く" };

/** お店ぜんたいの残り（品物のうち、いちばん少ないもの。品物がなければ null） */
export function shopStock(shop: Pick<Shop, "menu">): Stock | null {
  if (!shop.menu.length) return null;
  if (shop.menu.every((m) => m.stock === "out")) return "out";
  if (shop.menu.some((m) => m.stock !== "on")) return "few";
  return "on";
}
