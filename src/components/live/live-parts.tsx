"use client";

import Link from "next/link";
import { Badge, type BadgeColor } from "@/components/ui/badge";
import { STATE_LABEL, STOCK_LABEL, type ShopState, type Stock } from "@/lib/types";
import { useLive } from "./live-provider";

const STOCK_COLOR: Record<Stock, BadgeColor> = { on: "green", few: "yellow", out: "red" };
const STATE_COLOR: Record<ShopState, BadgeColor> = { prep: "gray", open: "green", break: "yellow", closed: "gray" };

export function StockBadge({ stock }: { stock: Stock }) {
  return <Badge color={STOCK_COLOR[stock]}>{STOCK_LABEL[stock]}</Badge>;
}

/** お店の状態（営業中など）＋ 品物の売り切れのまとめ */
export function LiveShopBadges({ shopId }: { shopId: string }) {
  const s = useLive().shops[shopId];
  if (!s) return null;
  const stocks = Object.values(s.stock);
  const out = stocks.filter((x) => x === "out").length;
  const few = stocks.filter((x) => x === "few").length;
  return (
    <span className="mx-badges">
      <Badge color={STATE_COLOR[s.state]}>{STATE_LABEL[s.state]}</Badge>
      {stocks.length > 0 && out === stocks.length && <Badge color="red">売り切れ</Badge>}
      {out > 0 && out < stocks.length && <Badge color="red">一部売り切れ</Badge>}
      {few > 0 && out === 0 && <Badge color="yellow">残りわずか</Badge>}
    </span>
  );
}

/** 1 品の残り */
export function LiveStock({ shopId, itemId }: { shopId: string; itemId: string }) {
  const st = useLive().shops[shopId]?.stock[itemId];
  return st ? <StockBadge stock={st} /> : null;
}

/** お店からのお知らせ（あれば） */
export function LiveNotice({ shopId }: { shopId: string }) {
  const n = useLive().shops[shopId]?.notice;
  return n ? (
    <p className="mx-notice" role="status">
      <span className="mx-notice-k">お店から</span>
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
      15秒ごとに自動で更新（{t}）
    </span>
  );
}

/** トップの「いまの様子」：売り切れ・残りわずかの品物と、実行委員のお知らせ */
export function LiveBoard({ names }: { names: Record<string, { shop: string; items: Record<string, string> }> }) {
  const live = useLive();
  const rows: { shopId: string; shop: string; item: string; stock: Stock }[] = [];
  for (const s of Object.values(live.shops)) {
    for (const [itemId, st] of Object.entries(s.stock)) {
      if (st !== "on" && names[s.id]) rows.push({ shopId: s.id, shop: names[s.id].shop, item: names[s.id].items[itemId] ?? itemId, stock: st });
    }
  }
  rows.sort((a, b) => (a.stock === b.stock ? 0 : a.stock === "out" ? -1 : 1));
  const notices = Object.values(live.shops).filter((s) => s.notice && names[s.id]);
  return (
    <div className="mx-board">
      {live.news.length > 0 && (
        <ul className="mx-news" aria-label="実行委員からのお知らせ">
          {live.news.map((n) => (
            <li key={n.id} className={n.pinned ? "mx-news--pin" : undefined}>
              <time>{new Date(n.at).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo" })}</time>
              <span>{n.text}</span>
            </li>
          ))}
        </ul>
      )}
      {rows.length === 0 && notices.length === 0 ? (
        <p className="mx-board-empty">いまは売り切れの品物はありません。</p>
      ) : (
        <ul className="mx-soldout">
          {rows.map((r) => (
            <li key={`${r.shopId}-${r.item}`}>
              <Link href={`/shops/${r.shopId}`}>
                <StockBadge stock={r.stock} />
                <span className="mx-soldout-item">{r.item}</span>
                <span className="mx-soldout-shop">{r.shop}</span>
              </Link>
            </li>
          ))}
          {notices.map((s) => (
            <li key={`n-${s.id}`}>
              <Link href={`/shops/${s.id}`}>
                <Badge color="blue">お知らせ</Badge>
                <span className="mx-soldout-item">{s.notice}</span>
                <span className="mx-soldout-shop">{names[s.id].shop}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <LiveClock />
    </div>
  );
}
