// 夢中万博のデータの形。保存先（Upstash Redis）にはこの形の JSON をそのまま入れる。

/** 部門。運営＝実行委員（ラジオ・受付など） */
export type DeptId = "taiken" | "chaya" | "chiiki" | "kojin" | "unei";

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
  dept: DeptId;
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

export type SiteData = { shops: Shop[]; places: Place[]; news: News[] };

export const DEPTS: Record<DeptId, { name: string; short: string; tagline: string }> = {
  taiken: { name: "体験部門", short: "体験", tagline: "遊んで、つくって、持って帰れる" },
  chaya: { name: "エンカレ茶屋部門", short: "茶屋", tagline: "あったかい、おいしい、ひと休み" },
  chiiki: { name: "地域部門", short: "地域", tagline: "つくる人と、その想いに出会う" },
  kojin: { name: "個人発表・展示", short: "発表", tagline: "ひとりひとりの「夢中」" },
  unei: { name: "実行委員", short: "運営", tagline: "ラジオ・案内" },
};
export const DEPT_ORDER: DeptId[] = ["taiken", "chaya", "chiiki", "kojin", "unei"];

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
