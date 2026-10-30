import type { Shop } from "./types";

/*
 * お店の「お客さんに見せる準備」がそろっているか（画面とサーバーの両方で使う。中身は純粋な関数だけ）。
 * 実行委員の「お店の情報」の一覧（「まだ：場所・ひとこと」「準備ができたお店 5／9」）と、お店の人の画面（お客さんに見せる準備）で使う。
 *  - 要るもの：場所（実行委員が決める）・ひとこと・どんなお店？・メニューと値段（食べる・飲むのお店だけ）。1 つでもまだなら「まだ」
 *  - あるとよいもの（なくてもよい。数に入れない）：当日の流れ・お店の思い。食べる・飲むでないお店は、メニューもこちら
 *  - 値段が空の品物は「値段が未定の品物」として数える（食べる・飲むのお店では、メニューと値段が「まだ」になる）
 */

/** 見る欄。menu は「メニューと値段」 */
export type ReadyKey = "place" | "catch" | "description" | "menu" | "schedule" | "message";

export type ReadyItem = {
  key: ReadyKey;
  /** 欄の名前（お店の人の画面の「お店の紹介を書く」と同じ字） */
  label: string;
  /** 「まだ：場所・ひとこと」に出す短い名前（品物はあって、値段だけが未定なら「値段」） */
  short: string;
  done: boolean;
};

export type Readiness = {
  /** 要るもの（この順に出す） */
  need: ReadyItem[];
  /** あるとよいもの（なくてもよい。「準備ができた」かどうかには数えない） */
  nice: ReadyItem[];
  /** 要るもののうち、まだのもの */
  missing: ReadyItem[];
  /** 要るものが全部そろっている */
  ready: boolean;
  /** 値段が空の品物の数 */
  noPrice: number;
};

export type ReadyShop = Pick<Shop, "kind" | "catch" | "description" | "message" | "placeId" | "menu" | "schedule">;

const filled = (s: string) => s.trim() !== "";

/**
 * お店ごとの準備。places は、いまある場所（地図のピン）の id を引けるもの（Set や Map）。
 * 選んだピンが消されていたら、場所は「まだ」（お客さんの画面にも場所が出ないので）
 */
export function readinessOf(shop: ReadyShop, places: { has(id: string): boolean }): Readiness {
  const noPrice = shop.menu.filter((m) => !filled(m.price)).length;
  const hasMenu = shop.menu.length > 0;
  const eat = shop.kind === "eat";
  const need: ReadyItem[] = [
    { key: "place", label: "場所", short: "場所", done: !!shop.placeId && places.has(shop.placeId) },
    { key: "catch", label: "ひとこと", short: "ひとこと", done: filled(shop.catch) },
    { key: "description", label: "どんなお店？", short: "どんなお店？", done: filled(shop.description) },
  ];
  if (eat) need.push({ key: "menu", label: "メニューと値段", short: hasMenu ? "値段" : "メニュー", done: hasMenu && noPrice === 0 });
  const nice: ReadyItem[] = [
    ...(eat ? [] : [{ key: "menu" as const, label: "メニューと値段", short: "メニュー", done: hasMenu }]),
    { key: "schedule", label: "当日の流れ", short: "当日の流れ", done: shop.schedule.length > 0 },
    { key: "message", label: "お店の思い", short: "お店の思い", done: filled(shop.message) },
  ];
  const missing = need.filter((x) => !x.done);
  return { need, nice, missing, ready: missing.length === 0, noPrice };
}

/** 「まだ：場所・ひとこと」の「場所・ひとこと」の所 */
export function missingText(r: Pick<Readiness, "missing">) {
  return r.missing.map((x) => x.short).join("・");
}
