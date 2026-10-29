"use client";

import { Icon } from "@/components/icons";

/** 知らせの帯の ×。押した帯だけを隠す（保存はしない） */
export function BannerClose({ label = "この知らせを閉じる" }: { label?: string }) {
  return (
    <button
      type="button"
      className="ui-banner-close"
      aria-label={label}
      onClick={(e) => e.currentTarget.closest(".ui-banner")?.setAttribute("hidden", "")}
    >
      <Icon name="閉じる" size={20} />
    </button>
  );
}
