"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Live } from "@/lib/live";
import { phaseOf, type Phase } from "@/lib/ops";

const Ctx = createContext<Live | null>(null);
/** 電波の様子：weak＝続けて読めなかった・ブラウザがオフラインと言っている。at＝最後に読めた時刻 */
export type Signal = { weak: boolean; at: number };
const SignalCtx = createContext<Signal>({ weak: false, at: 0 });
const EVERY_MS = 15_000;
/** この回数つづけて読めなかったら「電波が弱い」とする */
const FAILS_TO_WARN = 2;

/**
 * 「いまの様子」（売り切れ・お店の状態・お知らせ）を 15 秒ごとに読み直して、下の部品に配る。
 * 画面が裏に回っているあいだは読まない。戻ってきたらすぐ読む。
 * 読めないことが続いたら（またはオフラインになったら）、電波の様子（useSignal）で知らせる。
 */
export function LiveProvider({ initial, children }: { initial: Live; children: ReactNode }) {
  const [live, setLive] = useState(initial);
  const [fails, setFails] = useState(0);
  const [offline, setOffline] = useState(false);
  const [okAt, setOkAt] = useState(initial.at);
  // 最後に読めた時刻（読み直しのたびに作り直さないよう、ref にも持つ）
  const okAtRef = useRef(initial.at);

  useEffect(() => {
    let stop = false;
    async function load() {
      if (document.visibilityState !== "visible") return;
      try {
        const r = await fetch("/api/status", { cache: "no-store" });
        if (!r.ok) throw new Error(String(r.status));
        const next = (await r.json()) as Live;
        if (stop) return;
        // 届く順番が前後しても、古い様子で上書きしない
        setLive((cur) => (next.at >= cur.at ? next : cur));
        // サービスワーカーが返した前の保存分は、時刻が進まない。そのときは「読めなかった」に数える
        if (next.at > okAtRef.current) {
          okAtRef.current = next.at;
          setOkAt(next.at);
          setFails(0);
        } else {
          setFails((n) => n + 1);
        }
      } catch {
        // 電波が悪いときは、前の様子のまま
        if (!stop) setFails((n) => n + 1);
      }
    }
    const t = setInterval(load, EVERY_MS);
    const onVis = () => document.visibilityState === "visible" && load();
    const onOnline = () => {
      setOffline(false);
      load();
    };
    const onOffline = () => setOffline(true);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    if (!navigator.onLine) onOffline();
    // はじめの様子が古い（保存してあったページ・読めなかったとき）なら、すぐ読み直す
    if (Date.now() - okAtRef.current > EVERY_MS) load();
    return () => {
      stop = true;
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const signal: Signal = { weak: offline || fails >= FAILS_TO_WARN, at: okAt };
  return (
    <Ctx.Provider value={live}>
      <SignalCtx.Provider value={signal}>{children}</SignalCtx.Provider>
    </Ctx.Provider>
  );
}

export function useLive(): Live {
  const v = useContext(Ctx);
  if (!v) throw new Error("LiveProvider の中で使ってください");
  return v;
}

/** 電波の様子（帯を出すかどうか） */
export function useSignal(): Signal {
  return useContext(SignalCtx);
}

/**
 * 表示の時期（開催前・当日の朝・開催中・終了後）。サーバーが答えた時刻（live.at）で決めるので、
 * はじめの描画（サーバー）と画面の側で食いちがわない。15 秒ごとの読み直しで進む。実行委員が練習用に切り替えたらそれに従う
 */
export function usePhase(): Phase {
  const l = useLive();
  return phaseOf(l.at, l.phase ?? "auto");
}
