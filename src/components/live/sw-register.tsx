"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { APP_COMMIT, APP_VERSION } from "@/lib/version";

/**
 * お客さん側だけでサービスワーカー（public/sw.js）を登録する。本番だけ（開発中は HMR とぶつかるので登録しない）。
 * 版を ?v= で渡す → 版が変わると新しいサービスワーカーに入れかわり、古い保存分は消える。
 * 画面の中で移ったページ（RSC の読み込み）はページそのものが保存されないので、移るたびにいまの URL を渡して保存してもらう
 */
export function SwRegister() {
  const path = usePathname();

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    const v = encodeURIComponent(`${APP_VERSION}-${APP_COMMIT || "x"}`);
    navigator.serviceWorker.register(`/sw.js?v=${v}`, { scope: "/" }).catch(() => {
      // 登録できなくても、ふつうに使える
    });
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    let stop = false;
    navigator.serviceWorker.ready
      .then((reg) => {
        if (!stop) reg.active?.postMessage({ type: "keep-page", url: path });
      })
      .catch(() => {
        // 保存できなくても、ふつうに使える
      });
    return () => {
      stop = true;
    };
  }, [path]);

  return null;
}
