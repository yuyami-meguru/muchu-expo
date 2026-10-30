"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { phaseOf, type AdminLive, type Memo, type Phase, type SiteAlert } from "@/lib/ops";
import type { News } from "@/lib/types";
import { clock } from "../../_lib/client";
import { useStaffLive } from "../../_lib/use-staff-live";
import { markAlive, markExpired, useReportLive } from "../_components/session-signal";
import { everyText, pollMs } from "../ops-result";
import { useUnsavedGuard } from "../shops/[id]/use-unsaved-guard";
import { AlertCard } from "./alert-card";
import { MemoCard } from "./memo-card";
import { NewsEditor } from "./news-editor";
import "../ops.css";

/** 書きかけの欄があることを、まとめ役（NewsBoard）に知らせる。key ごとに、書きかけなら true */
export type MarkDirty = (key: string, dirty: boolean) => void;

/**
 * 全体のお知らせの画面。お知らせと全体の帯は、当日は 15 秒ごと（開催前・終了後は 1 分ごと）に読み直す（ほかの実行委員が出した分も入る）。
 * 自分が変えている途中に届いた古い読み込みは捨てる（押した結果が戻らないように）。読めないときは、いつの様子かを赤で出す。
 * お店の人への連絡と「見た」印は、従業員側の「いまの様子」（同じ間隔）から。
 * どこかに書きかけの文があるあいだは、下のタブなどでほかの画面へ移る前に聞く（書きかけが黙って消えないように）。
 */
export function NewsBoard({
  news: firstNews,
  alert: firstAlert,
  memo,
  acks,
  shops,
  ready,
  at: firstAt,
  phase: firstPhase,
}: {
  news: News[];
  alert: SiteAlert;
  memo: Memo | null;
  acks: Record<string, string>;
  shops: { id: string; name: string }[];
  ready: boolean;
  /** ページを開いたとき（サーバーの時刻） */
  at: number;
  /** ページを開いたときの、お客さんの画面の出し方（読み直しの間隔を決める） */
  phase: Phase;
}) {
  const [news, setNews] = useState(firstNews);
  const [alert, setAlert] = useState(firstAlert);
  const { live, expired, refresh } = useStaffLive<AdminLive>();
  useReportLive(live, expired);
  /** 最後に読めた時刻（サーバーの時刻）と、そのあとの読み込みが失敗したか */
  const [loaded, setLoaded] = useState({ at: firstAt, failed: false });
  /** 変えた回数。読み込みを始めたあとに変えていたら、その読み込みは古いので使わない */
  const changes = useRef(0);
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  // 読み直しの間隔（「いまの様子」に表示の時期が入っていれば、それで決める）
  const phaseNow = live?.phase ? phaseOf(live.at, live.phase) : firstPhase;
  const every = pollMs(phaseNow);
  const markDirty = useCallback<MarkDirty>((key, v) => setDirty((d) => (!!d[key] === v ? d : { ...d, [key]: v })), []);
  useUnsavedGuard(Object.values(dirty).some(Boolean), "書きかけの文があります（まだ出していません）。この画面を離れると消えます。離れますか？");

  useEffect(() => {
    let stop = false;
    async function load() {
      if (document.visibilityState !== "visible") return;
      const v = changes.current;
      try {
        const r = await fetch("/api/staff/news", { cache: "no-store", credentials: "same-origin" });
        const j = (await r.json().catch(() => null)) as { ok?: boolean; news?: News[]; alert?: SiteAlert; at?: number } | null;
        if (stop) return;
        // 実行委員でなくなった（ログインが切れた）
        if (r.status === 401 || r.status === 403) return markExpired();
        if (!r.ok || !j?.ok) return setLoaded((x) => ({ ...x, failed: true }));
        markAlive();
        // 読めた時刻（窓口の at、なければ返事の Date の時刻。どちらもサーバーの時計）
        setLoaded({ at: typeof j.at === "number" ? j.at : Date.parse(r.headers.get("date") ?? "") || 0, failed: false });
        if (v !== changes.current) return;
        if (j.news) setNews(j.news);
        if (j.alert) setAlert(j.alert);
      } catch {
        // 電波が弱いときは、次の読み込みで（赤い文で知らせる）
        if (!stop) setLoaded((x) => ({ ...x, failed: true }));
      }
    }
    const t = setInterval(load, every);
    const onVis = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("online", load);
    return () => {
      stop = true;
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("online", load);
    };
  }, [every]);

  const touch = () => {
    changes.current++;
  };

  return (
    <div className="st-stack">
      <p className={loaded.failed ? "ops-clock ops-clock--ng" : "ops-clock"}>
        <span>
          {loaded.failed
            ? `読み直せませんでした（電波を確かめてください）。お知らせと帯の表示は ${loaded.at ? clock(loaded.at) : "開いたとき"} のままです`
            : `お知らせと帯は ${loaded.at ? `${clock(loaded.at)} の様子` : "開いたときの様子"}（${everyText(phaseNow)}に更新）`}
        </span>
      </p>
      <nav className="ops-jump" aria-label="この画面の中">
        <a href="#news">お知らせ</a>
        <a href="#alert">全体の帯（雨・急ぎ）</a>
        <a href="#memo">お店の人への連絡</a>
      </nav>
      <NewsEditor news={news} setNews={setNews} touch={touch} ready={ready} markDirty={markDirty} />
      <AlertCard alert={alert} setAlert={setAlert} touch={touch} ready={ready} markDirty={markDirty} />
      <MemoCard live={live} first={{ memo, acks }} shops={shops} ready={ready} onSaved={refresh} markDirty={markDirty} phase={phaseNow} />
    </div>
  );
}
