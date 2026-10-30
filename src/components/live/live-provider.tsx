"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Live } from "@/lib/live";
import { LIVE_TIMING, phaseOf, type Phase } from "@/lib/ops";

const Ctx = createContext<Live | null>(null);
/**
 * 電波の様子：weak＝続けて読めなかった・ブラウザがオフラインと言っている。at＝最後に読めた時刻。
 * pageAt＝いま出しているページの中身を作った時刻（サーバーの時刻）。
 * stalePage＝ページの中身が古い（電波が弱いときにサービスワーカーが出した前の保存分など）ので、読み込み直している
 */
export type Signal = { weak: boolean; at: number; pageAt: number; stalePage: boolean };
const SignalCtx = createContext<Signal>({ weak: false, at: 0, pageAt: 0, stalePage: false });
/** この回数つづけて読めなかったら「電波が弱い」とする（ページの中身がもともと古いときは 1 回で） */
const FAILS_TO_WARN = 2;
/** 読めなかったあとは、表示の時期にかかわらずこの間隔で読み直す */
const RETRY_MS = 15_000;
/** ページの中身がこれより古ければ、読めしだい一度だけ読み込み直す（router.refresh） */
const STALE_PAGE_MS = 10 * 60_000;
/** 画面に戻ったときの読み直しは、前に読んでからこれだけたってから（行ったり来たりで読みすぎないように） */
const VISIBLE_GAP_MS = 5_000;

/**
 * 「いまの様子」（売り切れ・お店の状態・お知らせ）を読み直して、下の部品に配る。
 * 読み直しの間隔は表示の時期で変える（開催中 15 秒・当日の朝 30 秒・終了後 60 秒・開催前 120 秒。ops.ts の LIVE_TIMING）。
 * 画面が裏に回っているあいだは読まない。戻ってきたらすぐ読む。
 * 読めないことが続いたら（またはオフラインになったら）、電波の様子（useSignal）で知らせる。
 * サービスワーカーが返した前の保存分（ヘッダー x-muchu-sw: cache）は「読めなかった」に数える。
 * ページの中身が 10 分より古いとき（電波が弱くて前の保存分が出たときなど）は、読めしだい一度だけ読み込み直す
 */
export function LiveProvider({ initial, children }: { initial: Live; children: ReactNode }) {
  const router = useRouter();
  const [live, setLive] = useState(initial);
  const [fails, setFails] = useState(0);
  const [warn, setWarn] = useState(false);
  const [offline, setOffline] = useState(false);
  const [okAt, setOkAt] = useState(initial.at);
  // 読み直しのたびに作り直さないよう、ref にも持つ
  const okAtRef = useRef(initial.at);
  const liveRef = useRef(initial);
  const failsRef = useRef(0);
  const lastTry = useRef(0);
  // ページの中身を作った時刻（読み込み直すと、枠ごと新しい initial が来る）
  const pageAt = initial.at;
  const pageAtRef = useRef(pageAt);
  const checked = useRef(0);
  const [stale, setStale] = useState(0);

  // 読み込み直して新しい initial が来たら、そちらが新しければ使う
  useEffect(() => {
    pageAtRef.current = initial.at;
    if (initial.at > liveRef.current.at) {
      liveRef.current = initial;
      setLive(initial);
    }
  }, [initial]);

  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const fail = () => {
      failsRef.current += 1;
      setFails(failsRef.current);
      // ページの中身がもともと古い（手元の時計で 10 分より前に作った・そのあと読めていない）ときは、1 回で知らせる
      const p = pageAtRef.current;
      const oldPage = p > 0 && okAtRef.current <= p && Date.now() - p > STALE_PAGE_MS;
      setWarn(failsRef.current >= FAILS_TO_WARN || oldPage);
    };

    async function load() {
      if (document.visibilityState !== "visible") return;
      lastTry.current = Date.now();
      try {
        const r = await fetch("/api/status", { cache: "no-store" });
        if (!r.ok) throw new Error(String(r.status));
        const fromCache = r.headers.get("x-muchu-sw") === "cache";
        const next = (await r.json()) as Live;
        if (stop) return;
        // 届く順番が前後しても、古い様子で上書きしない
        if (next.at >= liveRef.current.at) {
          liveRef.current = next;
          setLive(next);
        }
        if (fromCache) return fail();
        if (next.at > okAtRef.current) {
          okAtRef.current = next.at;
          setOkAt(next.at);
        }
        failsRef.current = 0;
        setFails(0);
        setWarn(false);
        // ページの中身が古い（サーバーの時刻で比べる）→ 一度だけ読み込み直す
        const p = pageAtRef.current;
        if (p > 0 && checked.current !== p) {
          checked.current = p;
          if (next.at - p > STALE_PAGE_MS) {
            setStale(p);
            router.refresh();
          }
        }
      } catch {
        // 電波が悪いときは、前の様子のまま
        if (!stop) fail();
      }
    }

    function schedule() {
      if (stop) return;
      const l = liveRef.current;
      const every = LIVE_TIMING[phaseOf(l.at || Date.now(), l.phase ?? "auto")].pollMs;
      timer = setTimeout(
        async () => {
          await load();
          schedule();
        },
        failsRef.current > 0 ? Math.min(every, RETRY_MS) : every,
      );
    }

    const onVis = () => {
      if (document.visibilityState === "visible" && Date.now() - lastTry.current > VISIBLE_GAP_MS) load();
    };
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
    if (Date.now() - okAtRef.current > LIVE_TIMING.during.pollMs) load().then(schedule);
    else schedule();
    return () => {
      stop = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [router]);

  // 読み込み直しを頼んだのに 1 分たっても中身が新しくならない（電波が弱いなど）ときは、読めているあいだにもう一度頼む
  const stalePage = stale > 0 && stale === pageAt;
  useEffect(() => {
    if (!stalePage || fails > 0) return;
    const t = setTimeout(() => router.refresh(), 60_000);
    return () => clearTimeout(t);
  }, [stalePage, fails, router]);

  const signal: Signal = { weak: offline || warn, at: okAt, pageAt, stalePage };
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

/** LiveProvider の外（従業員側など）でも使える形（外なら null） */
export function useLiveMaybe(): Live | null {
  return useContext(Ctx);
}

/** 電波の様子（帯を出すかどうか） */
export function useSignal(): Signal {
  return useContext(SignalCtx);
}

/**
 * 表示の時期（開催前・当日の朝・開催中・終了後）。サーバーが答えた時刻（live.at）で決めるので、
 * はじめの描画（サーバー）と画面の側で食いちがわない。読み直しで進む。実行委員が練習用に切り替えたらそれに従う
 */
export function usePhase(): Phase {
  const l = useLive();
  return phaseOf(l.at, l.phase ?? "auto");
}
