"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { phaseOf } from "@/lib/ops";
import { APP_COMMIT, APP_VERSION } from "@/lib/version";
import { useLiveMaybe } from "./live-provider";

/** 電波を節約したい設定・とても遅い回線か（Chrome などの navigator.connection。無ければ分からない＝節約しない） */
function savingData() {
  const c = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  return !!c && (c.saveData === true || c.effectiveType === "slow-2g" || c.effectiveType === "2g");
}

/**
 * サービスワーカー（public/sw.js）を登録する。本番だけ（開発中は HMR とぶつかるので登録しない）。
 * お客さん側の枠のほか、従業員側（/staff・/join）の枠にも置ける（LiveProvider の外でもよい。従業員側のページは保存しない決まりは sw.js が守る）。
 * 版を ?v= で渡す → 版が変わると新しいサービスワーカーに入れかわり、古い保存分は消える。
 * 当日（11/28 の朝・開催中）だけ：
 *  - 画面の中で移ったページ（RSC の読み込み）はページそのものが保存されないので、移るたびにいまの URL を渡して保存してもらう
 *  - 下のタブのページを 1 つずつ先に保存してもらう（電波を節約する設定・とても遅い回線のときはしない）
 * 開催前は先に取りに行かない（サーバーと Upstash の回数を増やさないため。開いたページはふつうに保存される）
 */
export function SwRegister() {
  const path = usePathname();
  const live = useLiveMaybe();
  const phase = live && live.at ? phaseOf(live.at, live.phase ?? "auto") : null;
  const day = phase === "morning" || phase === "during";

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    const v = encodeURIComponent(`${APP_VERSION}-${APP_COMMIT || "x"}`);
    navigator.serviceWorker.register(`/sw.js?v=${v}`, { scope: "/" }).catch(() => {
      // 登録できなくても、ふつうに使える
    });
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator) || !day) return;
    if (/^\/(staff|join)(\/|$)/.test(path)) return;
    let stop = false;
    navigator.serviceWorker.ready
      .then((reg) => {
        if (stop || !reg.active) return;
        reg.active.postMessage({ type: "keep-page", url: location.pathname + location.search, day: true });
        if (!savingData()) reg.active.postMessage({ type: "warm", day: true });
      })
      .catch(() => {
        // 保存できなくても、ふつうに使える
      });
    return () => {
      stop = true;
    };
  }, [path, day]);

  return null;
}
