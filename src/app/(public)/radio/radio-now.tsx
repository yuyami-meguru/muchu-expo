"use client";

import { useLive } from "@/components/live/live-provider";
import type { RadioLive } from "@/lib/radio";

/** いま放送中か（15 秒ごとの「いまの様子」で変わる。届くまではページを開いたときの状態） */
export function RadioNow({ initial }: { initial: RadioLive }) {
  const r = useLive().radio ?? initial;
  return (
    <section className={r.onAir ? "rd-now rd-now--on" : "rd-now"} aria-live="polite">
      <p className="rd-lamp">
        <span className="rd-lamp-dot" aria-hidden="true" />
        {r.onAir ? "ON AIR　放送中" : "いまは放送していません"}
      </p>
      {r.onAir && r.now && <p className="rd-now-t">{r.now}</p>}
      {!r.onAir && <p className="rd-now-sub">放送の時間は、下の番組表を見てください。</p>}
    </section>
  );
}
