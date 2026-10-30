"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import type { AdminLive, StaffLiveShop } from "@/lib/ops";
import type { Shop } from "@/lib/types";
import { clock } from "../_lib/client";

/*
 * 実行委員の当日の画面（いまの様子・お店の一覧）で使う、「いまの様子」（15 秒ごとの読み込み）の重ね方。
 */

/**
 * いちばん新しいものを使う：ページを開いたときの中身・自分が押した答え（r.shop）・15 秒ごとの「いまの様子」。
 * 比べるのはサーバーの時刻（updatedAt）なので、遅れて届いた古い読み込みで、押した結果が戻らない。
 */
export function latest(base: Shop, mine: Shop | null | undefined, l: StaffLiveShop | undefined): Shop {
  let s = mine && mine.updatedAt >= base.updatedAt ? mine : base;
  if (l && l.updatedAt >= s.updatedAt) {
    s = { ...s, state: l.state, notice: l.notice, hidden: l.hidden, updatedAt: l.updatedAt, menu: s.menu.map((m) => (l.stock[m.id] ? { ...m, stock: l.stock[m.id] } : m)) };
  }
  return s;
}

/** お店と品物の形（「お店 id:品物 id,…」）。名前は「いまの様子」に入っていないので、形が変わったら読み込み直す */
export function shapeOf(shops: Pick<Shop, "id" | "menu">[]) {
  return shops
    .map((s) => `${s.id}:${s.menu.map((m) => m.id).sort().join(",")}`)
    .sort()
    .join("|");
}

/** お店・品物が増えた／減ったら、新しい名前を知るために画面を読み込み直す（同じ形では 1 回だけ） */
export function useShapeRefresh(live: AdminLive | null, known: string) {
  const router = useRouter();
  const asked = useRef("");
  useEffect(() => {
    if (!live) return;
    const now = Object.entries(live.shops)
      .map(([id, l]) => `${id}:${Object.keys(l.stock).sort().join(",")}`)
      .sort()
      .join("|");
    if (now !== known && asked.current !== now) {
      asked.current = now;
      router.refresh();
    }
  }, [live, known, router]);
}

const DAY = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric" });

/** 同じ日なら「13:05」、ちがう日なら「10/30 13:05」（日本時間） */
export function stamp(at: number, now: number) {
  return DAY.format(at) === DAY.format(now) ? clock(at) : `${DAY.format(at)} ${clock(at)}`;
}

/** いまの時刻を「13:05」で（押したあとの「○○しました（13:05）」に使う） */
export function clockNow() {
  return clock(Date.now());
}

/** いまの時刻（ミリ秒。押したあとの処理で使う。描画の中では使わない） */
export function nowMs() {
  return Date.now();
}
