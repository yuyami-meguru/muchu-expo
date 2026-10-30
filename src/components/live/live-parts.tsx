"use client";

import Link from "next/link";
import { Badge, type BadgeColor } from "@/components/ui/badge";
import type { AlertLevel, Phase } from "@/lib/ops";
import { hhmm } from "@/lib/schedule";
import { STATE_LABEL, STOCK_LABEL, type News, type ShopState, type Stock } from "@/lib/types";
import { useLive, usePhase } from "./live-provider";

const STOCK_COLOR: Record<Stock, BadgeColor> = { on: "green", few: "yellow", out: "red" };
const STATE_COLOR: Record<ShopState, BadgeColor> = { prep: "gray", open: "green", break: "yellow", closed: "gray" };
/** お店の札に添える説明（「準備中」「終了」だけでは、これから開くのか・もう終わったのかが分かりにくい） */
const STATE_NOTE: Partial<Record<ShopState, string>> = { prep: "まだ開いていません", closed: "本日は終わりました" };
/** 品物の札（販売中・売り切れ）を出すのは、営業中・休憩中のお店だけ。準備中・終了のお店の品物に「販売中」と出さない */
const SELLING: ShopState[] = ["open", "break"];

/**
 * お客さんに見せるお店の状態。
 * 開催前は出さない（試しに押した「売り切れ」「営業中」が、本番の様子と読まれないように）。終了後は、どのお店も「終了」
 */
export function shownState(phase: Phase, state: ShopState | undefined): ShopState | null {
  if (!state || phase === "before") return null;
  return phase === "after" ? "closed" : state;
}

/** そのお店の、お客さんに見せる状態（出さないときは null） */
export function useShopState(shopId: string): ShopState | null {
  return shownState(usePhase(), useLive().shops[shopId]?.state);
}

/** 品物の札を出してよいか（営業中・休憩中） */
export const isSelling = (state: ShopState | null | undefined) => !!state && SELLING.includes(state);

export function StockBadge({ stock }: { stock: Stock }) {
  return <Badge color={STOCK_COLOR[stock]}>{STOCK_LABEL[stock]}</Badge>;
}

/** お店の状態の札（「準備中（まだ開いていません）」など） */
export function StateBadge({ state }: { state: ShopState }) {
  const note = STATE_NOTE[state];
  return (
    <Badge color={STATE_COLOR[state]}>
      {STATE_LABEL[state]}
      {note && `（${note}）`}
    </Badge>
  );
}

/** お店の状態（営業中など）＋ 品物の売り切れのまとめ。開催前は何も出さない */
export function LiveShopBadges({ shopId }: { shopId: string }) {
  const s = useLive().shops[shopId];
  const state = useShopState(shopId);
  if (!s || !state) return null;
  const stocks = isSelling(state) ? Object.values(s.stock) : [];
  const out = stocks.filter((x) => x === "out").length;
  const few = stocks.filter((x) => x === "few").length;
  return (
    <span className="mx-badges">
      <StateBadge state={state} />
      {stocks.length > 0 && out === stocks.length && <Badge color="red">売り切れ</Badge>}
      {out > 0 && out < stocks.length && <Badge color="red">一部売り切れ</Badge>}
      {few > 0 && out === 0 && <Badge color="yellow">残りわずか</Badge>}
    </span>
  );
}

/** 1 品の残り（営業中・休憩中のお店だけ） */
export function LiveStock({ shopId, itemId }: { shopId: string; itemId: string }) {
  const st = useLive().shops[shopId]?.stock[itemId];
  const state = useShopState(shopId);
  return st && isSelling(state) ? <StockBadge stock={st} /> : null;
}

/** お店からのお知らせ（あれば）。終了後は古いお知らせになるので出さない */
export function LiveNotice({ shopId }: { shopId: string }) {
  const n = useLive().shops[shopId]?.notice;
  const phase = usePhase();
  return n && phase !== "after" ? (
    <p className="mx-notice" role="status">
      <span className="mx-notice-k">お店からのお知らせ</span>
      {n}
    </p>
  ) : null;
}

/** 最後に読んだ時刻 */
export function LiveClock() {
  const { at } = useLive();
  const t = new Date(at).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Tokyo" });
  return (
    <span className="mx-clock">
      <span className="mx-clock-dot" aria-hidden="true" />
      15 秒ごとに自動で更新（{t}）
    </span>
  );
}

/** 日本時間の「13:51」。now とちがう日なら「11/27 13:51」 */
export function stampOf(at: number, now: number) {
  const a = new Date(at + 9 * 3600e3);
  const n = new Date(now + 9 * 3600e3);
  const hm = hhmm(a.getUTCHours() * 60 + a.getUTCMinutes());
  const sameDay = a.getUTCFullYear() === n.getUTCFullYear() && a.getUTCMonth() === n.getUTCMonth() && a.getUTCDate() === n.getUTCDate();
  return sameDay ? hm : `${a.getUTCMonth() + 1}/${a.getUTCDate()} ${hm}`;
}

/** 実行委員からのお知らせ（固定のものは濃い色）。時刻は「13:51 更新」、ちがう日のものは日付も */
export function NewsList({ news, now }: { news: News[]; now: number }) {
  if (!news.length) return null;
  return (
    <ul className="mx-news" aria-label="実行委員からのお知らせ">
      {news.map((n) => (
        <li key={n.id} className={n.pinned ? "mx-news--pin" : undefined}>
          <span>{n.text}</span>
          <time dateTime={new Date(n.at).toISOString()}>{stampOf(n.at, now)} 更新</time>
        </li>
      ))}
    </ul>
  );
}

type Names = Record<string, { shop: string; items: Record<string, string> }>;
type BoardRow = { id: string; shop: string; out: string[]; few: string[]; all: boolean; notice: string };

/**
 * トップの「いまの様子」：実行委員のお知らせと、売り切れ・残りわずか・お店からのお知らせ（お店ごとに 1 行にまとめる）。
 * 品物は営業中・休憩中のお店だけ。多いときは limit 行で止めて「ほか ○ 件」。
 * 開催前は売り切れの欄を出さず「当日 10:00 から出ます」、終了後はお知らせだけ（無ければ何も出さない）
 */
export function LiveBoard({ names, limit = 5 }: { names: Names; limit?: number }) {
  const live = useLive();
  const phase = usePhase();
  const news = <NewsList news={live.news} now={live.at} />;
  if (phase === "after") return live.news.length ? <div className="mx-board">{news}</div> : null;
  if (phase === "before") {
    return (
      <div className="mx-board">
        {news}
        <p className="mx-board-wait">当日（11/28）10:00 から、ここに売り切れ・お店の様子が出ます。</p>
      </div>
    );
  }

  const rows: BoardRow[] = [];
  for (const [id, n] of Object.entries(names)) {
    const s = live.shops[id];
    if (!s) continue;
    const items = isSelling(s.state) ? Object.entries(s.stock) : [];
    const out = items.filter(([, v]) => v === "out").map(([k]) => n.items[k] ?? k);
    const few = items.filter(([, v]) => v === "few").map(([k]) => n.items[k] ?? k);
    if (out.length || few.length || s.notice) rows.push({ id, shop: n.shop, out, few, all: items.length > 1 && out.length === items.length, notice: s.notice });
  }
  // 売り切れのあるお店 → 残りわずか → お知らせだけ、の順（同じなら並び順のまま）
  const rank = (r: BoardRow) => (r.out.length ? 0 : r.few.length ? 1 : 2);
  rows.sort((a, b) => rank(a) - rank(b));
  const shown = rows.slice(0, limit);
  const rest = rows.length - shown.length;

  return (
    <div className="mx-board">
      {news}
      {rows.length === 0 ? (
        <p className="mx-board-empty">いまは売り切れの品物はありません。</p>
      ) : (
        <ul className="mx-soldout" aria-label="売り切れ・お店からのお知らせ">
          {shown.map((r) => (
            <li key={r.id}>
              <Link href={`/shops/${r.id}`}>
                <span className="mx-soldout-shop">{r.shop}</span>
                {r.out.length > 0 && (
                  <span className="mx-soldout-line">
                    <Badge color="red">売り切れ</Badge>
                    <span>{r.all ? "全部の品物" : r.out.join("、")}</span>
                  </span>
                )}
                {r.few.length > 0 && (
                  <span className="mx-soldout-line">
                    <Badge color="yellow">残りわずか</Badge>
                    <span>{r.few.join("、")}</span>
                  </span>
                )}
                {r.notice && (
                  <span className="mx-soldout-line">
                    <Badge color="blue">お店からのお知らせ</Badge>
                    <span>{r.notice}</span>
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {rest > 0 && (
        <Link href="/shops" className="mx-board-more">
          ほか {rest} 件 ▶ お店・出し物の一覧へ
        </Link>
      )}
      <LiveClock />
    </div>
  );
}

/**
 * ラジオが ON AIR のときだけ出る札（赤い点滅ランプ＋いまの内容、/radio へ）。
 * radio がまだ届いていないとき（はじめの描画）と、放送していないときは何も出さない。
 */
export function OnAirBadge({ className }: { className?: string }) {
  const r = useLive().radio;
  if (!r?.onAir) return null;
  return (
    <Link href="/radio" className={className ? `mx-onair ${className}` : "mx-onair"} aria-label={`校内ラジオ 放送中${r.now ? `：${r.now}` : ""}（ラジオのページへ）`}>
      <span className="mx-onair-lamp" aria-hidden="true" />
      <span className="mx-onair-k">ON AIR</span>
      <span className="mx-onair-t">{r.now || "校内ラジオ 放送中"}</span>
      <span className="mx-onair-go" aria-hidden="true">
        ▶
      </span>
    </Link>
  );
}

const ALERT_TAG: Record<AlertLevel, string> = { info: "お知らせ", rain: "雨", urgent: "急ぎ" };

/**
 * 全体の帯（実行委員が「全体のお知らせ」の画面で出す。雨・急ぎの知らせ）。お客さん側の全部のページで、上の帯のすぐ下に出す（本文を下へ押す）。
 * 色だけに頼らず「お知らせ」「雨」「急ぎ」の字も付ける。急ぎは role="alert"（読み上げがすぐ知らせる）、ほかは控えめに知らせる
 */
export function SiteAlertBar() {
  const live = useLive();
  const a = live.alert;
  const body = a?.text ? (
    <div className={`mx-alert mx-alert--${a.level}`}>
      <div className="mx-alert-in">
        <span className="mx-alert-tag">{ALERT_TAG[a.level]}</span>
        <p className="mx-alert-text">
          {a.text}
          {a.at > 0 && <time dateTime={new Date(a.at).toISOString()}>{stampOf(a.at, live.at)} 更新</time>}
        </p>
      </div>
    </div>
  ) : null;
  return (
    <>
      <div aria-live="polite">{a?.level !== "urgent" && body}</div>
      <div role="alert">{a?.level === "urgent" && body}</div>
    </>
  );
}
