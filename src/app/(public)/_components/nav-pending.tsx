"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { SlowHint } from "@/components/ui/slow-hint";

/** これより長く待っても次の画面にならなければ、知らせを消す（電波が切れて、ふつうの読み込みに切りかわったときなど） */
const GIVE_UP_MS = 20_000;

/** 押されたのが、このサイトの別の画面へのリンクか（新しいタブ・ダウンロード・同じ画面の中の移動・電話などは除く） */
function isPageLink(e: MouseEvent) {
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;
  const a = (e.target as Element | null)?.closest?.("a[href]");
  if (!(a instanceof HTMLAnchorElement) || (a.target && a.target !== "_self") || a.hasAttribute("download")) return false;
  const url = new URL(a.href, location.href);
  return url.origin === location.origin && !(url.pathname === location.pathname && url.search === location.search);
}

/** 画面の場所の比べ方（パスと ? のあと。# は見ない） */
const placeKey = (pathname: string, search: string) => `${pathname}?${new URLSearchParams(search).toString()}`;

/**
 * 画面を移るあいだの知らせ（お客さん側）。リンクを押したらすぐ、上に細い帯を出して本文を少しうすくし、
 * 3 秒たっても次の画面にならなければ「少し時間がかかっています」と出す。次の画面になったら消える。
 * loading.tsx にしない理由：loading.tsx を置くとページを先に流し始めるので、見つからないページ・不具合のページも 200 で返る。
 * するとサービスワーカーが（5xx のときだけ前の保存分を出す作りのため）不具合のページをそのまま出して保存してしまう
 */
export function NavPending() {
  const here = placeKey(usePathname(), useSearchParams().toString());
  /** 押したときにいた画面（ここから移るのを待っている） */
  const [from, setFrom] = useState<string | null>(null);
  // 画面が変わったら待つのをやめる（あとで「戻る」でこの画面に戻ったときに、また出ないように）
  if (from !== null && from !== here) setFrom(null);
  const pending = from === here;

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (isPageLink(e)) setFrom(placeKey(location.pathname, location.search));
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("mx-navigating", pending);
    if (!pending) return;
    const t = setTimeout(() => setFrom(null), GIVE_UP_MS);
    return () => clearTimeout(t);
  }, [pending]);

  if (!pending) return null;
  return (
    <div className="mx-navbar">
      <span className="mx-navbar-line" aria-hidden="true" />
      <span className="sr-only" role="status">
        読み込み中です
      </span>
      <SlowHint after={3000} />
    </div>
  );
}
