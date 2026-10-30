"use client";

import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { hhmm } from "@/lib/schedule";
import { useSignal } from "./live-provider";

/** 送る欄のあるページ（電波が弱いときは、送る前に知らせる） */
const SENDING = new Set(["/survey", "/radio"]);

/** 日本時間の日付（「10/31」） */
const dayOf = (at: number) => {
  const d = new Date(at + 9 * 3600e3);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
};
const noSub = () => () => {};

/**
 * 電波が弱いときの帯（1 行）。上の帯のすぐ下に出して本文を下へ押す（本文に重ねない）。つながったら消える。
 * ページの中身が古い（前に保存したページが出た）ときも、いつの内容かを出す（読み込み直すと消える）。
 * 時刻は、今日なら「13:05」、ちがう日なら「10/30 13:05」。
 * 読み上げで知らせるため、入れ物（role="status"）はいつも置いておき、中身だけ出し入れする
 */
export function SignalBanner() {
  const { weak, at, pageAt, stalePage } = useSignal();
  const path = usePathname();
  // 今日の日付（画面の時計で。サーバーと最初の描画では空 → 日付つきで出す）
  const today = useSyncExternalStore(noSub, () => dayOf(Date.now()), () => "");
  const when = (t: number) => {
    const d = new Date(t + 9 * 3600e3);
    const time = hhmm(d.getUTCHours() * 60 + d.getUTCMinutes());
    return dayOf(t) === today ? time : `${dayOf(t)} ${time}`;
  };
  let text = "";
  if (weak) {
    if (SENDING.has(path)) text = "電波が弱いです。送るときは電波のよい所で";
    else if (at > 0) text = `電波が弱いです（${when(at)} の情報）`;
    else text = "電波が弱いです";
  } else if (stalePage && pageAt > 0) {
    text = `${when(pageAt)} の内容です。新しい内容を読み込んでいます`;
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
