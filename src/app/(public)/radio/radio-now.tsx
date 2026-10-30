"use client";

import { useLive } from "@/components/live/live-provider";
import type { RadioLive } from "@/lib/radio";

/**
 * いま放送中か（「いまの様子」の読み直しで変わる。届くまではページを開いたときの状態）。
 * 放送していないときは、番組表があれば「下の番組表を」、無ければ「決まったらお知らせします」
 */
export function RadioNow({ initial, hasProgram }: { initial: RadioLive; hasProgram: boolean }) {
  const r = useLive().radio ?? initial;
  return (
    <section className={r.onAir ? "rd-now rd-now--on" : "rd-now"} aria-live="polite">
      <p className="rd-lamp">
        <span className="rd-lamp-dot" aria-hidden="true" />
        {r.onAir ? "ON AIR　放送中" : "いまは放送していません"}
      </p>
      {r.onAir && r.now && <p className="rd-now-t">{r.now}</p>}
      {!r.onAir && <p className="rd-now-sub">{hasProgram ? "放送の時間は、下の番組表を見てください。" : "放送の時間は、決まったらこのページでお知らせします。"}</p>}
    </section>
  );
}
