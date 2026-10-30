"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useShopState } from "@/components/live/live-parts";
import { cx } from "@/components/ui/cx";

/** 一覧のカードのリンク。終了したお店はうすく（15 秒ごとの「いまの様子」で変わる） */
export function ShopCardLink({ shopId, className, children }: { shopId: string; className: string; children: ReactNode }) {
  const state = useShopState(shopId);
  return (
    <Link href={`/shops/${shopId}`} className={cx(className, state === "closed" && "sp-card--closed")}>
      {children}
    </Link>
  );
}
