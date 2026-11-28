"use client";

import { useState, type CSSProperties } from "react";
import { useLive } from "@/components/live/live-provider";
import { Sprite } from "@/components/pixel/sprites";
import { AwardBanner } from "./award-banner";
import { SurveyEntry } from "./survey-entry";

/*
 * ひみつのホーム（secret-home.tsx）の、押したり読み直したりで変わるところ
 */

/** 染める色（ドット絵の色に合わせた 8 色。赤・オレンジ・黄・緑・水色・青・紫・ピンク） */
const DYES = ["#e2453c", "#f39a2b", "#f7d03a", "#5fbe85", "#7fd0f5", "#3b5cc4", "#8e7cf0", "#ee82b4"];

/**
 * 白いバンダナが 8 枚。［色をつける］を押すと、1 枚ずつそれぞれの色になる（もう 1 度押すと白にもどる）。
 * 開いた時は白（「同じ白から」）。押すまで変わらないので、下の方まで読んでから押しても見られる
 */
export function Bandanas() {
  const [dyed, setDyed] = useState(false);
  return (
    <div className="hs-dye">
      <div className={dyed ? "hs-bandanas is-dyed" : "hs-bandanas"} aria-hidden="true">
        {DYES.map((c, i) => (
          <Sprite key={c} name="bandana" size={72} className="hs-bandana" style={{ "--c": c, "--i": i } as CSSProperties} />
        ))}
      </div>
      <button type="button" className="hm-btn hm-btn--main hs-dye-btn" aria-pressed={dyed} onClick={() => setDyed((v) => !v)}>
        {dyed ? "白にもどす" : "色をつける"}
      </button>
      <p className="sr-only" aria-live="polite">
        {dyed ? "白いバンダナが、8 枚ともちがう色になりました。" : ""}
      </p>
    </div>
  );
}

/** 夢中アワードの発表（発表したとき）と、アンケート（受け付けているとき）。どちらも無ければ何も出さない */
export function SecretTop({ awardTitle }: { awardTitle: string }) {
  const live = useLive();
  if (!live.awardOn && live.surveyOpen === false) return null;
  return (
    <div className="hm-top hs-top">
      <div className="hm-wrap hm-top-in">
        <AwardBanner title={awardTitle} />
        <SurveyEntry after />
      </div>
    </div>
  );
}
