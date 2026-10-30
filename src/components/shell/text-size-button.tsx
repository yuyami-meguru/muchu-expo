"use client";

import { useSyncExternalStore } from "react";

// 「文字を大きく」の状態は <html class="big"> そのもの。押したら知らせて、ボタンを描き直す
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
const isBig = () => document.documentElement.classList.contains("big");

/**
 * 「文字を大きく」（お年寄り向け）。この端末だけに覚える。
 * 押した後も字は変えない（長くなると狭い画面ではみ出す）。押しているかは、四角の ✓ と aria-pressed で示す
 */
export function TextSizeButton() {
  const big = useSyncExternalStore(subscribe, isBig, () => false);
  function toggle() {
    const next = !big;
    document.documentElement.classList.toggle("big", next);
    try {
      localStorage.setItem("muchu-big", next ? "1" : "0");
    } catch {
      // 覚えられなくても、いまの画面では大きくなる
    }
    listeners.forEach((fn) => fn());
  }
  return (
    <button type="button" className="mx-textsize" aria-pressed={big} onClick={toggle}>
      <span className="mx-textsize-box" aria-hidden="true">
        {big ? "✓" : ""}
      </span>
      文字を大きく
    </button>
  );
}
