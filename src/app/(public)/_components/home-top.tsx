"use client";

import { OnAirBadge } from "@/components/live/live-parts";
import { useLive, usePhase } from "@/components/live/live-provider";
import { DAY_START } from "@/lib/ops";
import { AwardBanner } from "./award-banner";
import { NextBus } from "./next-bus";
import { SurveyEntry } from "./survey-entry";

/**
 * ホームの表紙より上（上の帯のすぐ下）に出すもの。何も無いときは出さない。
 *  - 終了後：「本日は終了しました」、アンケート（受け付けているとき）、帰りの送迎バス（当日だけ）
 *  - 夢中アワードを発表したとき：発表の帯
 *  - 校内ラジオが放送中のとき：ON AIR の札
 */
export function HomeTop({ awardTitle }: { awardTitle: string }) {
  const live = useLive();
  const phase = usePhase();
  const after = phase === "after";
  // 当日（11/28）のうちは「本日は」、次の日からは「エンカレ夢中万博は」
  const today = live.at >= DAY_START && live.at < DAY_START + 86_400_000;
  if (!after && !live.awardOn && !live.radio?.onAir) return null;
  return (
    <div className="hm-top">
      <div className="hm-wrap hm-top-in">
        {after && (
          <section className="hm-end" aria-label="ごあいさつ">
            <p className="hm-end-t">{today ? "本日は終了しました。" : "エンカレ夢中万博は終了しました。"}</p>
            <p>ご来場ありがとうございました。</p>
          </section>
        )}
        <AwardBanner title={awardTitle} />
        <OnAirBadge />
        {after && <SurveyEntry />}
        {after && <NextBus big />}
      </div>
    </div>
  );
}
