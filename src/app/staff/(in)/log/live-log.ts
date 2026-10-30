import { STATE_LABEL, STOCK_LABEL, type Shop, type ShopState, type Stock } from "@/lib/types";
import type { LiveLogEntry } from "@/lib/store";

/*
 * 当日の動き（営業の状態・売り切れ・お店からのお知らせの切り替え）の見せ方。画面（page.tsx）と表（csv/route.ts）で同じものを使う。
 */

const DAY_KEY = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" });
const DAY_LABEL = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", weekday: "short" });
const TIME = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", hour: "numeric", minute: "2-digit" });

/** 日本時間の日付（「2026-11-28」） */
export const dayKey = (at: number) => DAY_KEY.format(at);
/** 「11/28(土)」 */
export const dayLabel = (at: number) => DAY_LABEL.format(at);
/** 「13:05」 */
export const timeOf = (at: number) => TIME.format(at);

export const KIND_LABEL: Record<LiveLogEntry["kind"], string> = { state: "営業の状態", stock: "品物の残り", notice: "お店からのお知らせ" };

export type Names = { shop: (id: string) => string; item: (shop: string, item: string) => string };

export function namesOf(shops: Shop[]): Names {
  const shop = new Map(shops.map((s) => [s.id, s]));
  return {
    shop: (id) => shop.get(id)?.name ?? `（消したお店：${id}）`,
    item: (s, item) => shop.get(s)?.menu.find((m) => m.id === item)?.name ?? "（いまは無い品物）",
  };
}

/** 何がどう変わったか（「品物『焼きそば』を売り切れに」など） */
export function whatOf(e: LiveLogEntry, names: Names) {
  if (e.kind === "state") return `「${STATE_LABEL[e.value as ShopState] ?? e.value}」にした`;
  if (e.kind === "stock") return `『${names.item(e.shop, e.item ?? "")}』を「${STOCK_LABEL[e.value as Stock] ?? e.value}」にした`;
  return e.value ? `「${e.value}」を出した` : "消した";
}

export const byLabel = (by: string) => (by === "admin" ? "実行委員" : "お店の人");

export type ShopSummary = {
  shop: string;
  name: string;
  /** はじめて営業中にした時刻 */
  firstOpen: number | null;
  /** 品物ごとに、売り切れになった時刻（何度もあればすべて） */
  soldOut: { item: string; name: string; at: number[] }[];
  /** 最後に「終了」にした時刻 */
  closed: number | null;
  /** 休憩にした回数 */
  breaks: number;
  /** 動いた数 */
  moves: number;
};

/** お店ごとのまとめ（entries はどの順でもよい） */
export function summarize(entries: LiveLogEntry[], names: Names, order: string[]): ShopSummary[] {
  const map = new Map<string, ShopSummary>();
  for (const e of [...entries].sort((a, b) => a.at - b.at)) {
    let s = map.get(e.shop);
    if (!s) map.set(e.shop, (s = { shop: e.shop, name: names.shop(e.shop), firstOpen: null, soldOut: [], closed: null, breaks: 0, moves: 0 }));
    s.moves++;
    if (e.kind === "state") {
      if (e.value === "open" && s.firstOpen === null) s.firstOpen = e.at;
      if (e.value === "closed") s.closed = e.at;
      if (e.value === "break") s.breaks++;
    } else if (e.kind === "stock" && e.value === "out" && e.item) {
      let it = s.soldOut.find((x) => x.item === e.item);
      if (!it) s.soldOut.push((it = { item: e.item, name: names.item(e.shop, e.item), at: [] }));
      it.at.push(e.at);
    }
  }
  const rank = (id: string) => {
    const i = order.indexOf(id);
    return i < 0 ? order.length : i;
  };
  return [...map.values()].sort((a, b) => rank(a.shop) - rank(b.shop));
}

/** 表（CSV）の 1 マス。「= + - @」などで始まる値は、表計算ソフトが式として動かさないよう ' を付ける */
function cell(v: string) {
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** 当日の動きの表（CSV）。Excel で文字化けしないよう BOM を付け、行は CRLF で区切る。古い順 */
export function toCsv(entries: LiveLogEntry[], names: Names) {
  const head = ["日付", "時刻", "お店", "だれが", "種類", "品物", "変えた後"];
  const rows = [...entries]
    .sort((a, b) => a.at - b.at)
    .map((e) => [
      dayKey(e.at),
      timeOf(e.at),
      names.shop(e.shop),
      byLabel(e.by),
      KIND_LABEL[e.kind] ?? e.kind,
      e.kind === "stock" ? names.item(e.shop, e.item ?? "") : "",
      e.kind === "state" ? (STATE_LABEL[e.value as ShopState] ?? e.value) : e.kind === "stock" ? (STOCK_LABEL[e.value as Stock] ?? e.value) : e.value || "（消した）",
    ]);
  return "﻿" + [head, ...rows].map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}
