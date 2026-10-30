"use client";

import { useEffect } from "react";

const ASK = "保存していない変更があります。このページを離れると消えます。離れますか？";

/**
 * 保存していない入力があるあいだ、ページを離れる前に聞く（お店の編集・地図のピン・部門・夢中アワードで使う）。
 *  - 閉じる・読み込み直す・ほかのサイトへ：ブラウザの確認（beforeunload）
 *  - サイトの中のリンク（左のメニュー・下のタブなど）：確認の小窓。「キャンセル」ならこのページに残る
 */
export function useUnsavedGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const onUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // 古い Safari は returnValue が要る
      e.returnValue = "";
    };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target instanceof Element ? e.target.closest("a[href]") : null;
      if (!(a instanceof HTMLAnchorElement)) return;
      // 新しいタブ・ファイルの保存・ほかのサイト（こちらは beforeunload が聞く）は、そのまま
      if ((a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return;
      if (!window.confirm(ASK)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", onUnload);
    // リンクの動き（next/link）より先に聞くため、capture で受ける
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty]);
}
