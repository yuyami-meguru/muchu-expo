"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { SendResult } from "../../_lib/client";

/*
 * 実行委員のログインが切れたかどうかを、画面のどこからでも上の帯（staff-bands.tsx）に知らせる小さな置き場。
 *  - 15 秒ごとの「いまの様子」が 401 を返した・押したボタンの答えが 401 → 切れた
 *  - そのあと読み直しが通った（ほかのタブで入り直したなど） → 切れていない
 * サーバーに余分に聞きには行かない（いまある読み込み・押した答えを使うだけ）。
 */

type Signal = { expired: boolean; okAt: number };
let state: Signal = { expired: false, okAt: 0 };
const subs = new Set<() => void>();

function set(next: Signal) {
  state = next;
  for (const f of subs) f();
}

const subscribe = (f: () => void) => {
  subs.add(f);
  return () => {
    subs.delete(f);
  };
};

/** ログインが切れたと分かった */
export function markExpired() {
  if (!state.expired) set({ ...state, expired: true });
}

/** 読み込みが通った（ログインは生きている）。okAt はそのときの時刻（期限の時計より新しければ、期限は延びている） */
export function markAlive() {
  set({ expired: false, okAt: Date.now() });
}

/**
 * 押した答えがログイン切れなら「切れた」と知らせる（答えはそのまま返す）。
 * 実行委員だけの窓口は、ログインが無いと 403（「実行委員の合言葉でログインしてください」）を返すので、403 も切れたとみなす
 */
export function noteAuth<T extends SendResult<object>>(r: T): T {
  if (!r.ok && (r.status === 401 || r.status === 403)) markExpired();
  return r;
}

export function useSessionSignal(): Signal {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

/**
 * useStaffLive の答えを、上の帯に伝える（読めた → 生きている、401 → 切れた）。
 * live はとどくたびに新しい物になるので、それを合図にする
 */
export function useReportLive(live: unknown, expired: boolean) {
  useEffect(() => {
    if (expired) markExpired();
  }, [expired]);
  useEffect(() => {
    if (live) markAlive();
  }, [live]);
}
