"use client";

import { useState, type MouseEvent } from "react";
import { buttonClass } from "@/components/ui/button";
import { readinessOf, type ReadyItem } from "@/lib/readiness";
import type { Shop } from "@/lib/types";
import { INTRO_ID, partLabel } from "./shop-intro";

/**
 * 欄へ飛ぶ：下の「お店の紹介を書く」が閉じていたら開き、その欄を画面の真ん中に出して、すぐ書けるようにする。
 * 値段の欄が見つからなければ（書きかけでその品物を消したなど）メニューのまとまりへ。どちらも無ければ、ふつうのリンク（#…）として動かす
 */
function jump(e: MouseEvent<HTMLAnchorElement>, id: string) {
  const el = document.getElementById(id) ?? (id.startsWith(INTRO_ID.price("")) ? document.getElementById(INTRO_ID.menu) : null);
  if (!el) return;
  e.preventDefault();
  const box = el.closest("details");
  if (box && !box.open) box.open = true;
  el.scrollIntoView({ block: "center" });
  // 欄そのものか、まとまり（メニュー・当日の流れ）のいちばん上の欄・［品物を足す］
  const target = el.matches("input, textarea") ? el : el.querySelector<HTMLElement>("input, textarea, button");
  target?.focus({ preventScroll: true });
}

/**
 * お店の人の画面の「お客さんに見せる準備」：お客さんのお店のページに出す情報がそろっているか（決め方は lib/readiness.ts）。
 * ✓ と「まだ」の一覧で、まだの所には［書く］（下の「お店の紹介を書く」の、その欄へ飛ぶ）。全部そろったら「✓ 準備ができました」。
 * 場所は実行委員が決める（お店の人は変えられない）ので、見せるだけ。
 * early（開催前）なら、まだがあるときは開いておく。当日は閉じておく（出す場所は ShopHome で決める：開催前は上、当日はいちばん下）
 */
export function ShopReady({ shop, places, early }: { shop: Shop; places: Map<string, string>; early: boolean }) {
  const r = readinessOf(shop, places);
  const [open, setOpen] = useState(() => early && !r.ready);
  const placeName = places.get(shop.placeId);
  // 欄の名前は「お店の紹介を書く」と同じ字に（出し物は「どんな出し物？」「出し物にこめた思い」）
  const labelOf = (x: ReadyItem) => (x.key === "description" || x.key === "message" ? partLabel(x.key, shop.kind) : x.label);
  const shortOf = (x: ReadyItem) => (x.key === "description" || x.key === "message" ? partLabel(x.key, shop.kind) : x.short);
  // お店の人が書けるもののうち、まだのもの（場所は実行委員が決める）
  const todo = r.missing.filter((x) => x.key !== "place");
  const summary = r.ready
    ? "✓ 準備ができました"
    : todo.length
      ? `まだ ${todo.length} つ：${todo.map(shortOf).join("・")}`
      : "書く所はそろいました（場所は実行委員が決めます）";
  const tone = r.ready ? "sh-ready-sum sh-ready-sum--ok" : todo.length ? "sh-ready-sum" : "sh-ready-sum sh-ready-sum--wait";

  /** 飛ぶ先の欄。値段だけがまだなら、値段が空のいちばん上の品物の値段の欄 */
  const targetOf = (x: ReadyItem) => {
    if (x.key !== "menu") return INTRO_ID[x.key as "catch" | "description" | "message" | "schedule"];
    const noPrice = shop.menu.find((m) => !m.price.trim());
    return noPrice ? INTRO_ID.price(noPrice.id) : INTRO_ID.menu;
  };

  /** 欄の補足（メニューと値段だけ） */
  const detailOf = (x: ReadyItem, need: boolean) => {
    if (x.key !== "menu") return "";
    if (r.noPrice) return `値段が未定の品物が ${r.noPrice} つあります（決まったら書いてください）`;
    if (!shop.menu.length) return need ? "品物と値段を書いてください" : "品物を売らないお店は、なくて大丈夫です";
    return "";
  };

  const row = (x: ReadyItem, need: boolean) => {
    const detail = detailOf(x, need);
    // まだの所と、値段が未定の品物があるメニューには［書く］
    const write = !x.done || (x.key === "menu" && r.noPrice > 0);
    const id = targetOf(x);
    return (
      <li key={x.key} className="sh-ready-item" data-done={x.done || undefined} data-nice={need ? undefined : ""}>
        <span className="sh-ready-mark">
          {x.done ? "✓" : "まだ"}
          {x.done && <span className="sr-only">（できています）</span>}
        </span>
        <span className="sh-ready-text">
          {labelOf(x)}
          {detail && <small>{detail}</small>}
        </span>
        {write && (
          <a href={`#${id}`} className={buttonClass({ variant: "secondary", size: "md", className: "sh-ready-go" })} onClick={(e) => jump(e, id)}>
            書く<span className="sr-only">（{labelOf(x)}）</span>
          </a>
        )}
      </li>
    );
  };

  return (
    <details className="st-intro sh-ready" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className="st-intro-sum">
        <span>お客さんに見せる準備</span>
        <span className={tone}>{summary}</span>
      </summary>
      <div className="st-intro-body">
        <p className="st-muted sh-ready-lead">
          {r.ready ? "お客さんのお店のページに出す情報が、そろっています。" : "お客さんのお店のページに出す情報です。「まだ」の所は［書く］から書いて、［お店の紹介を保存］を押してください。"}
        </p>
        <ul className="sh-ready-list">
          <li className="sh-ready-item" data-done={placeName ? "" : undefined} data-nice={placeName ? undefined : ""}>
            <span className="sh-ready-mark">
              {placeName ? "✓" : "未定"}
              {placeName && <span className="sr-only">（決まっています）</span>}
            </span>
            <span className="sh-ready-text">場所：{placeName || "実行委員が決めます（いまは未定）"}</span>
          </li>
          {r.need.filter((x) => x.key !== "place").map((x) => row(x, true))}
        </ul>
        <h3 className="sh-ready-h">あるとよいもの（なくても大丈夫）</h3>
        <ul className="sh-ready-list">{r.nice.map((x) => row(x, false))}</ul>
      </div>
    </details>
  );
}
