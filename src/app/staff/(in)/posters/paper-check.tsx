"use client";

import { useEffect, useState } from "react";

/**
 * 刷る前の確かめ（字のはみ出し）。紙の中の data-fit の付いた所（ポスターの中身・店名・ひとこと・当日の流れ、フロアの案内の一覧・部屋）が、
 * 字が多くて枠に収まっていない（切れて刷られる）ものを数えて出す。紙の中の大きさは紙の幅に対する割合なので、画面の縮小表示で測っても紙と同じ。
 *  - data-fit：縦にはみ出している（隠れた行がある）。字の飾り（ふち・影）や行の高さの端数で数えないよう、半行より多いときだけ
 *  - data-fit-line：1 行で「…」に切っている所が、実際に切れている
 * 字の形（フォント）を読みこんでから測る。
 */
export function PaperCheck() {
  const [cut, setCut] = useState<string[] | null>(null);
  useEffect(() => {
    let alive = true;
    const measure = () => {
      if (!alive) return;
      const shown = (el: HTMLElement) => el.offsetParent !== null;
      const tall = [...document.querySelectorAll<HTMLElement>("[data-fit]")]
        .filter((el) => shown(el) && el.scrollHeight - el.clientHeight > parseFloat(getComputedStyle(el).fontSize) * 0.6)
        .map((el) => el.dataset.fit ?? "");
      const wide = [...document.querySelectorAll<HTMLElement>("[data-fit-line]")]
        .filter((el) => shown(el) && el.scrollWidth - el.clientWidth > 1)
        .map((el) => el.dataset.fitLine ?? "");
      setCut([...new Set([...tall, ...wide])]);
    };
    const t = window.setTimeout(() => {
      if (document.fonts) document.fonts.ready.then(measure, measure);
      else measure();
    }, 300);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, []);
  if (!cut) return null;
  return cut.length === 0 ? (
    <p className="pst-check-ok">字のはみ出し：ありません（どの紙も、枠の中に収まっています）</p>
  ) : (
    <p className="pst-check-ng" role="status">
      字が多くて、切れて刷られる所：{cut.length} か所（{cut.join("、")}）。短くするか、そのまま刷るなら、切れた所はスマホで見てもらいます。
    </p>
  );
}
