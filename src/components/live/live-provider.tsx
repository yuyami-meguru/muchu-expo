"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Live } from "@/lib/live";

const Ctx = createContext<Live | null>(null);
const EVERY_MS = 15_000;

/**
 * 「いまの様子」（売り切れ・お店の状態・お知らせ）を 15 秒ごとに読み直して、下の部品に配る。
 * 画面が裏に回っているあいだは読まない。戻ってきたらすぐ読む。
 */
export function LiveProvider({ initial, children }: { initial: Live; children: ReactNode }) {
  const [live, setLive] = useState(initial);
  useEffect(() => {
    let stop = false;
    async function load() {
      if (document.visibilityState !== "visible") return;
      try {
        const r = await fetch("/api/status", { cache: "no-store" });
        if (r.ok && !stop) setLive((await r.json()) as Live);
      } catch {
        // 電波が悪いときは、前の様子のまま
      }
    }
    const t = setInterval(load, EVERY_MS);
    const onVis = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stop = true;
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);
  return <Ctx.Provider value={live}>{children}</Ctx.Provider>;
}

export function useLive(): Live {
  const v = useContext(Ctx);
  if (!v) throw new Error("LiveProvider の中で使ってください");
  return v;
}
