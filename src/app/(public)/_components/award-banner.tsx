"use client";

import Link from "next/link";
import { useLive } from "@/components/live/live-provider";
import { Sprite } from "@/components/pixel/sprites";

/**
 * ホームに置く「夢中アワード 発表！」の帯。発表したとき（受賞のお店があって発表がオン＝live.awardOn）だけ出す。
 * 「いまの様子」の読み直しで変わるので、ホームを開いたままの人にも出る。名前（title）は呼ぶ側で設定から渡す
 */
export function AwardBanner({ title }: { title: string }) {
  if (!useLive().awardOn) return null;
  return (
    <Link href="/award" className="aw-banner">
      <Sprite name="trophy" size={44} />
      <span>
        <strong>{title} 発表！</strong>
        <small>選ばれた「夢中」を見る</small>
      </span>
      <span className="aw-banner-go" aria-hidden="true">
        ▶
      </span>
    </Link>
  );
}
