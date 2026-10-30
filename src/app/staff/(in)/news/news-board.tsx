"use client";

import { useEffect, useRef, useState } from "react";
import type { AdminLive, Memo, SiteAlert } from "@/lib/ops";
import type { News } from "@/lib/types";
import { useStaffLive } from "../../_lib/use-staff-live";
import { AlertCard } from "./alert-card";
import { MemoCard } from "./memo-card";
import { NewsEditor } from "./news-editor";
import "../ops.css";

/**
 * 全体のお知らせの画面。お知らせと全体の帯は 15 秒ごとに読み直す（ほかの実行委員が出した分も入る）。
 * 自分が変えている途中に届いた古い読み込みは捨てる（押した結果が戻らないように）。
 * お店の人への連絡と「見た」印は、従業員側の「いまの様子」（15 秒ごと）から。
 */
export function NewsBoard({
  news: firstNews,
  alert: firstAlert,
  memo,
  acks,
  shops,
  ready,
}: {
  news: News[];
  alert: SiteAlert;
  memo: Memo | null;
  acks: Record<string, string>;
  shops: { id: string; name: string }[];
  ready: boolean;
}) {
  const [news, setNews] = useState(firstNews);
  const [alert, setAlert] = useState(firstAlert);
  const { live, refresh } = useStaffLive<AdminLive>();
  /** 変えた回数。読み込みを始めたあとに変えていたら、その読み込みは古いので使わない */
  const changes = useRef(0);

  useEffect(() => {
    let stop = false;
    async function load() {
      if (document.visibilityState !== "visible") return;
      const v = changes.current;
      try {
        const r = await fetch("/api/staff/news", { cache: "no-store", credentials: "same-origin" });
        const j = (await r.json().catch(() => null)) as { ok?: boolean; news?: News[]; alert?: SiteAlert } | null;
        if (stop || !r.ok || !j?.ok || v !== changes.current) return;
        if (j.news) setNews(j.news);
        if (j.alert) setAlert(j.alert);
      } catch {
        // 電波が弱いときは、次の読み込みで
      }
    }
    const t = setInterval(load, 15_000);
    const onVis = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stop = true;
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const touch = () => {
    changes.current++;
  };

  return (
    <div className="st-stack">
      <nav className="ops-jump" aria-label="この画面の中">
        <a href="#news">お知らせ</a>
        <a href="#alert">全体の帯（雨・急ぎ）</a>
        <a href="#memo">お店の人への連絡</a>
      </nav>
      <NewsEditor news={news} setNews={setNews} touch={touch} ready={ready} />
      <AlertCard alert={alert} setAlert={setAlert} touch={touch} ready={ready} />
      <MemoCard live={live} first={{ memo, acks }} shops={shops} ready={ready} onSaved={refresh} />
    </div>
  );
}
