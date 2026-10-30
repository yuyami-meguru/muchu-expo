"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { shownState, useShopState } from "@/components/live/live-parts";
import { useLive, usePhase } from "@/components/live/live-provider";
import { cx } from "@/components/ui/cx";

/**
 * 一覧のカードのリンク。終了したお店はうすく（「いまの様子」の読み直しで変わる）。
 * 読み上げの名前は、お店の名前と状態だけ（labelledBy）。ひとこと・値段・場所は説明（describedBy）として後から読む
 */
export function ShopCardLink({
  shopId,
  className,
  labelledBy,
  describedBy,
  children,
}: {
  shopId: string;
  className: string;
  labelledBy?: string;
  describedBy?: string;
  children: ReactNode;
}) {
  const state = useShopState(shopId);
  return (
    <Link href={`/shops/${shopId}`} className={cx(className, state === "closed" && "sp-card--closed")} aria-labelledby={labelledBy} aria-describedby={describedBy}>
      {children}
    </Link>
  );
}

/** 「いま開いている」のお店（営業中）か。開催前・終了後はどのお店も入らない */
function useIsOpen() {
  const live = useLive();
  const phase = usePhase();
  return (id: string) => shownState(phase, live.shops[id]?.state) === "open";
}

/**
 * 「いま開いている」で絞っているとき（on）は、ids のどれかが営業中のときだけ中身を出す（部門ごと・カードごとに使う）。
 * 一覧はサーバーで全部作っておき、出すかどうかを「いまの様子」で決めるので、読み直しのたびに入れかわる
 */
export function OpenOnly({ on, ids, children }: { on: boolean; ids: string[]; children: ReactNode }) {
  const isOpen = useIsOpen();
  return !on || ids.some(isOpen) ? children : null;
}

/**
 * 絞り込みの結果の件数（「「食べる・飲む」は 4 件です」）。読み上げにも伝える（role="status"。絞り込みを変えても題名は変わらないため）。
 * 0 件のときは、そのわけ（開催前は「当日 10:00 から」など）
 */
export function FilterCount({ filter, label, ids }: { filter: string; label: string; ids: string[] }) {
  const isOpen = useIsOpen();
  const phase = usePhase();
  const n = filter === "open" ? ids.filter(isOpen).length : ids.length;
  let text: string;
  if (filter === "open") {
    text =
      phase === "before"
        ? "当日（11/28）10:00 から、開いているお店・出し物がここに出ます。"
        : phase === "after"
          ? "エンカレ夢中万博は終了しました。ご来場ありがとうございました。"
          : n
            ? `いま開いているのは ${n} 件です。`
            : "いま開いているお店・出し物はありません。";
  } else if (!n) {
    text = "この条件のお店・出し物は、まだありません。";
  } else {
    text = filter === "all" ? `お店・出し物は、ぜんぶで ${n} 件です。` : `「${label}」は ${n} 件です。`;
  }
  return (
    <p className={n ? "sp-count" : "sp-count sp-count--empty"} role="status">
      {text}
    </p>
  );
}
