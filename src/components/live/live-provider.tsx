"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Live } from "@/lib/live";

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

  useEffect(() => {
    let stop = false;
    async function load() {
      if (document.visibilityState !== "visible") return;
      try {
        const r = await fetch("/api/status", { cache: "no-store" });
        if (!r.ok) throw new Error(String(r.status));
        const next = (await r.json()) as Live;
        if (stop) return;
        setLive(next);
        // サービスワーカーが返した前の保存分は、時刻が進まない。そのときは「読めなかった」に数える
        if (next.at > okAt) {
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
    return () => {
      stop = true;
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [okAt]);

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
