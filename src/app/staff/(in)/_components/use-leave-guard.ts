"use client";

import { useEffect } from "react";

/**
 * まだ保存していない書きかけがあるあいだ、ページを閉じる・読み込み直す前にブラウザの確認を出す（お店の人の画面）。
 * サイトの中で移るときは聞かない（紹介の書きかけは端末に残しているので、戻ってくれば出る）。
 */
export function useLeaveGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const onUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // 古い Safari は returnValue が要る
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [dirty]);
}
