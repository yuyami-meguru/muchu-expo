"use client";

import { LiveBoard } from "@/components/live/live-parts";
import { useLive, usePhase } from "@/components/live/live-provider";
import type { TimedRow } from "@/lib/schedule";
import { ComingUp } from "./coming-up";
import { NextBus } from "./next-bus";

type Names = Record<string, { shop: string; items: Record<string, string> }>;

const LEAD = {
  before: "実行委員からのお知らせです。",
  morning: "売り切れ・残りわずかの品物と、お知らせです。",
  during: "売り切れ・残りわずかの品物と、お知らせです。",
} as const;

/**
 * ホームの「いまの様子」（売り切れ・お知らせ・このあと・次の送迎バス）。
 * 終了後は売り切れの欄をしまい、実行委員のお知らせがあるときだけ「お知らせ」として出す
 */
export function NowSection({ names, timed }: { names: Names; timed: TimedRow[] }) {
  const phase = usePhase();
  const news = useLive().news;
  if (phase === "after" && !news.length) return null;
  return (
    <section className="hm-sec" id="now" aria-labelledby="now-h">
      <div className="hm-wrap">
        <h2 id="now-h" className="hm-h2 px-title">
          {phase === "after" ? "お知らせ" : "いまの様子"}
        </h2>
        {phase !== "after" && <p className="hm-lead">{LEAD[phase]}</p>}
        <LiveBoard names={names} />
        <ComingUp rows={timed} />
        {phase !== "after" && <NextBus />}
      </div>
    </section>
  );
}
