import type { SiteAlert, PhaseMode } from "./ops";
import type { RadioLive } from "./radio";
import type { News, ShopState, SiteData, Stock } from "./types";

// 15 秒ごとに配る「いまの様子」の形（/api/status）。画面の側（LiveProvider）とサーバーで同じものを使う。
export type LiveShop = { id: string; state: ShopState; notice: string; stock: Record<string, Stock>; updatedAt: number };
/**
 * radio は /api/status から届く（はじめの描画で渡されなければ undefined → 届くまで出さない）。
 * alert は全体の帯（出していなければ null）、phase は表示の時期の設定（auto なら日時で決める。決め方は ops.ts の phaseOf）
 */
export type Live = {
  at: number;
  shops: Record<string, LiveShop>;
  news: News[];
  radio?: RadioLive;
  alert?: Pick<SiteAlert, "level" | "text" | "at"> | null;
  phase?: PhaseMode;
  /** 夢中アワードを発表したか（受賞のお店が 1 つ以上あって、発表がオン） */
  awardOn?: boolean;
  /** アンケートを受け付けているか */
  surveyOpen?: boolean;
};

export type LiveOps = { alert: SiteAlert; phase: PhaseMode; awardOn: boolean; surveyOpen: boolean };

export function liveOf(data: SiteData, radio?: RadioLive, ops?: LiveOps): Live {
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
  return {
    at: Date.now(),
    shops,
    news: data.news,
    ...(radio ? { radio } : {}),
    ...(ops
      ? {
          alert: ops.alert.on ? { level: ops.alert.level, text: ops.alert.text, at: ops.alert.at } : null,
          phase: ops.phase,
          awardOn: ops.awardOn,
          surveyOpen: ops.surveyOpen,
        }
      : {}),
  };
}

/** 読めなかったときの「いまの様子」（空。時刻 0 なので、読めしだい置きかわる） */
export const EMPTY_LIVE: Live = { at: 0, shops: {}, news: [] };
