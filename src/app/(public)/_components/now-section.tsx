"use client";

import { LiveBoard, type BoardNames } from "@/components/live/live-parts";
import { useLive, usePhase } from "@/components/live/live-provider";
import type { TimedRow } from "@/lib/schedule";
import { ComingUp } from "./coming-up";
import { NextBus } from "./next-bus";

/**
 * ホームの「いまの様子」（売り切れ・お知らせ・このあと）。
 * 開催前は、お知らせ（あれば）・当日の予定・「当日 10:00 から出ます」。
 * 終了後は売り切れの欄をしまい、実行委員のお知らせがあるときだけ「お知らせ」として出す。
 * 次の送迎バスは、当日（朝・開催中）は表紙の下の 1 行（hero-parts.tsx の DayStrip）に出るので、ここでは重ねて出さない
 * （出すのは、当日なのに表示の時期が「開催前」のままのときだけ。NextBus は当日でなければ何も出さない）
 */
export function NowSection({ names, timed }: { names: BoardNames; timed: TimedRow[] }) {
  const phase = usePhase();
  const news = useLive().news;
  if (phase === "after" && !news.length) return null;
  const lead = phase === "before" ? (news.length ? "実行委員からのお知らせです。" : "") : phase === "after" ? "" : "売り切れ・残りわずかの品物と、お知らせです。";
  return (
    <section className="hm-sec" id="now" aria-labelledby="now-h">
      <div className="hm-wrap">
        <h2 id="now-h" className="hm-h2 px-title">
          {phase === "after" ? "お知らせ" : "いまの様子"}
        </h2>
        {lead && <p className="hm-lead">{lead}</p>}
        <LiveBoard names={names} />
        <ComingUp rows={timed} />
        {phase === "before" && <NextBus />}
      </div>
    </section>
  );
}
