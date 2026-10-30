import type { RadioLive } from "./radio";
import type { News, ShopState, SiteData, Stock } from "./types";

// 15 秒ごとに配る「いまの様子」の形（/api/status）。画面の側（LiveProvider）とサーバーで同じものを使う。
export type LiveShop = { id: string; state: ShopState; notice: string; stock: Record<string, Stock>; updatedAt: number };
/** radio は /api/status から届く（はじめの描画で渡されなければ undefined → 届くまで出さない） */
export type Live = { at: number; shops: Record<string, LiveShop>; news: News[]; radio?: RadioLive };

export function liveOf(data: SiteData, radio?: RadioLive): Live {
  const shops: Record<string, LiveShop> = {};
  for (const s of data.shops) {
    if (s.hidden) continue;
    shops[s.id] = {
      id: s.id,
      state: s.state,
      notice: s.notice,
      stock: Object.fromEntries(s.menu.map((m) => [m.id, m.stock])),
      updatedAt: s.updatedAt,
    };
  }
  return { at: Date.now(), shops, news: data.news, ...(radio ? { radio } : {}) };
}
