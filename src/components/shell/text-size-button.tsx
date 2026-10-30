"use client";

import { useLayoutEffect, useSyncExternalStore } from "react";

// 「文字を大きく」の状態は <html class="big"> そのもの。押したら知らせて、ボタンを描き直す
const KEY = "muchu-big";
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
const isBig = () => document.documentElement.classList.contains("big");
/** この画面で押した値（端末に覚えられないときも、開いているあいだはこれを守る）。まだ押していなければ null */
let chosen: boolean | null = null;

/** 選んだ値：この画面で押した値 → 端末に覚えた値 の順。どちらも無ければ null（そのときは何もしない） */
function wanted(): boolean | null {
  if (chosen !== null) return chosen;
  try {
    const v = localStorage.getItem(KEY);
    return v === "1" ? true : v === "0" ? false : null;
  } catch {
    return null;
  }
}

/** html の class を選んだ値に合わせる。変えたらボタンにも知らせる */
function applyWanted() {
  const want = wanted();
  if (want === null || isBig() === want) return;
  document.documentElement.classList.toggle("big", want);
  listeners.forEach((fn) => fn());
}

/**
 * 「文字を大きく」を保つ見張り役（app/layout.tsx に 1 つ置く。画面には何も出さない）。
 * ふつうは <head> の小さなスクリプトが、描く前に class を付ける。ところが「ページが見つかりません」のときなどは、
 * Next がブラウザの側で画面全体を作り直し（スクリプトは動かない）、html の class も書き直される。
 * それで、描いた直後（画面に出る前）と、あとで class が書き直されたときに、選んだ値へ戻す
 */
export function TextSizeKeeper() {
  useLayoutEffect(() => {
    applyWanted();
    const watch = new MutationObserver(applyWanted);
    watch.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => watch.disconnect();
  }, []);
  return null;
}

/**
 * 「文字を大きく」（お年寄り向け）。この端末だけに覚える。
 * 押した後も字は変えない（長くなると狭い画面ではみ出す）。押しているかは、四角の ✓ と aria-pressed で示す
 */
export function TextSizeButton() {
  const big = useSyncExternalStore(subscribe, isBig, () => false);
  function toggle() {
    const next = !isBig();
    chosen = next;
    document.documentElement.classList.toggle("big", next);
    try {
      localStorage.setItem(KEY, next ? "1" : "0");
    } catch {
      // 覚えられなくても、いまの画面では大きくなる（chosen で守る）
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
