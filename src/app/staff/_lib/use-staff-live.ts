"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { phaseOf, type AdminLive, type ShopLive } from "@/lib/ops";

// 当日（朝・開催中）は 15 秒ごと。開催前・終了後は 60 秒ごと（売り切れなどはお客さんに出ないので。Upstash の回数を増やさないため）。
// 押したあと・画面を開いたときは refresh() ですぐ、新しく読む（?fresh=1）
const DAY_MS = 15_000;
const QUIET_MS = 60_000;
/** 画面に戻ったときの読み直しは、前に読んでからこれだけたってから（行ったり来たりで読みすぎないように） */
const VISIBLE_GAP_MS = 5_000;

/** 次に読むまでの間隔（表示の時期で。まだ読めていなければ当日の間隔） */
function intervalOf(live: AdminLive | ShopLive | null) {
  if (!live) return DAY_MS;
  const p = phaseOf(live.at, live.phase ?? "auto");
  return p === "morning" || p === "during" ? DAY_MS : QUIET_MS;
}

/**
 * 従業員側の「いまの様子」を読み直す（GET /api/staff/live）。当日は 15 秒ごと、開催前・終了後は 60 秒ごと、画面に戻ったときも。
 * 別のスマホや実行委員が押した売り切れ・連絡が、読み込み直さなくても入る。
 * 画面が裏に回っているあいだは読まない。
 * refresh() は今すぐ、使い回しなしで新しく読む（押したあとなど）。ふだんの読み直しは、サーバーが少しだけ使い回す（api/staff/live/route.ts）
 */
export function useStaffLive<T extends AdminLive | ShopLive>() {
  const [live, setLive] = useState<T | null>(null);
  const [failed, setFailed] = useState(false);
  // ログインが切れた（QR の作り直し・期限切れ）。読めないのとは分けて、入り直し方を出せるように
  const [expired, setExpired] = useState(false);
  const stop = useRef(false);
  const latest = useRef<T | null>(null);
  const lastTry = useRef(0);

  const load = useCallback(async (fresh: boolean) => {
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
    lastTry.current = Date.now();
    try {
      const r = await fetch(fresh ? "/api/staff/live?fresh=1" : "/api/staff/live", { cache: "no-store", credentials: "same-origin" });
      const json = (await r.json().catch(() => null)) as ({ ok?: boolean } & T) | null;
      if (stop.current) return;
      if (r.status === 401) {
        setExpired(true);
        return;
      }
      if (!r.ok || !json?.ok) {
        setFailed(true);
        return;
      }
      setExpired(false);
      setFailed(false);
      // at は「中身はこれより新しい」時刻（ふだんの読み直しは、使い回しの分だけ前の時刻で来る：api/staff/live/route.ts）。新しい方だけ使う
      if (!latest.current || json.at >= latest.current.at) latest.current = json;
      setLive((cur) => (!cur || json.at >= cur.at ? json : cur));
    } catch {
      if (!stop.current) setFailed(true);
    }
  }, []);

  /** 今すぐ新しく読む（押したあとなど） */
  const refresh = useCallback(() => load(true), [load]);

  useEffect(() => {
    stop.current = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = () => {
      timer = setTimeout(async () => {
        await load(false);
        if (!stop.current) tick();
      }, intervalOf(latest.current));
    };
    const onVis = () => {
      if (document.visibilityState === "visible" && Date.now() - lastTry.current > VISIBLE_GAP_MS) load(false);
    };
    const onOnline = () => load(false);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("online", onOnline);
    // 画面を開いた直後は新しく読む（ページの中身と食いちがわないように）
    const first = setTimeout(() => load(true).then(() => !stop.current && tick()), 0);
    return () => {
      stop.current = true;
      if (timer) clearTimeout(timer);
      clearTimeout(first);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("online", onOnline);
    };
  }, [load]);

  return { live, failed, expired, refresh };
}
