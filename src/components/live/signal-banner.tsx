"use client";

import { usePathname } from "next/navigation";
import { hhmm } from "@/lib/schedule";
import { useSignal } from "./live-provider";

/** 送る欄のあるページ（電波が弱いときは、送る前に知らせる） */
const SENDING = new Set(["/survey", "/radio"]);

/**
 * 電波が弱いときの帯（1 行）。上の帯のすぐ下に出して本文を下へ押す（本文に重ねない）。つながったら消える。
 * 読み上げで知らせるため、入れ物（role="status"）はいつも置いておき、中身だけ出し入れする
 */
export function SignalBanner() {
  const { weak, at } = useSignal();
  const path = usePathname();
  let text = "";
  if (weak) {
    if (SENDING.has(path)) text = "電波が弱いです。送るときは電波のよい所で";
    else if (at > 0) {
      const d = new Date(at + 9 * 3600e3);
      text = `電波が弱いです（${hhmm(d.getUTCHours() * 60 + d.getUTCMinutes())} の情報）`;
    } else text = "電波が弱いです";
  }
  return (
    <div role="status" className="mx-signal-slot">
      {text && (
        <p className="mx-signal">
          <span aria-hidden="true">📶</span>
          {text}
        </p>
      )}
    </div>
  );
}
