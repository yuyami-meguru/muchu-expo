"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/icons";
import { useLive } from "@/components/live/live-provider";
import { Sprite } from "@/components/pixel/sprites";

/** アンケートを受け付けているときだけ中身を出す（受付を止めたら、「いまの様子」の読み直しで消える） */
export function IfSurveyOpen({ children }: { children: ReactNode }) {
  return useLive().surveyOpen === false ? null : children;
}

/**
 * ホームのアンケートへの入口（受付を止めているときは出さない）。
 * after＝終了後（もう家に帰った人も見るので「お帰りの前に」を付けない。ご来場の方へのページの終了後の文と同じ）
 */
export function SurveyEntry({ after }: { after?: boolean }) {
  return (
    <IfSurveyOpen>
      <Link href="/survey" className="hm-survey">
        <Sprite name="note" size={36} />
        <span>
          <strong>{after ? "アンケートにご協力ください" : "お帰りの前に、アンケートにご協力ください"}</strong>
          <small>1〜2 分・答えられる問いだけで大丈夫です</small>
        </span>
        <Icon name="右へ" size={22} />
      </Link>
    </IfSurveyOpen>
  );
}
