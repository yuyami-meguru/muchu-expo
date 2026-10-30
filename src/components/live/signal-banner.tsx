"use client";

import { useSignal } from "./live-provider";

/** 電波が弱いときに画面の上に出す帯。つながったら消える */
export function SignalBanner() {
  const { weak, at } = useSignal();
  if (!weak) return null;
  const t = new Date(at).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo" });
  return (
    <p className="mx-signal" role="status" aria-live="polite">
      <span aria-hidden="true">📶</span>電波が弱いので、{t} の情報を表示しています
    </p>
  );
}
