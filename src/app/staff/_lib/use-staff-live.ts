"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AdminLive, ShopLive } from "@/lib/ops";

// 当日は 20 台ほどが読み続けるので、15 秒ごと（押したあとは refresh() ですぐ読む）
const EVERY_MS = 15_000;

/**
 * 従業員側の「いまの様子」を 15 秒ごとと、画面に戻ったときに読み直す（GET /api/staff/live）。
 * 別のスマホや実行委員が押した売り切れ・呼び出し・連絡が、読み込み直さなくても入る。
 * 画面が裏に回っているあいだは読まない。refresh() で今すぐ読む（押したあとなど）。
 */
export function useStaffLive<T extends AdminLive | ShopLive>() {
  const [live, setLive] = useState<T | null>(null);
  const [failed, setFailed] = useState(false);
  // ログインが切れた（QR の作り直し・期限切れ）。読めないのとは分けて、入り直し方を出せるように
  const [expired, setExpired] = useState(false);
  const stop = useRef(false);

  const refresh = useCallback(async () => {
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
    try {
      const r = await fetch("/api/staff/live", { cache: "no-store", credentials: "same-origin" });
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
      setLive((cur) => (!cur || json.at >= cur.at ? json : cur));
    } catch {
      if (!stop.current) setFailed(true);
    }
  }, []);

  useEffect(() => {
    stop.current = false;
    const t = setInterval(refresh, EVERY_MS);
    const onVis = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("online", refresh);
    const first = setTimeout(refresh, 0);
    return () => {
      stop.current = true;
      clearInterval(t);
      clearTimeout(first);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("online", refresh);
    };
  }, [refresh]);

  return { live, failed, expired, refresh };
}
