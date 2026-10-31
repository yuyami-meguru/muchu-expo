"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState, useTransition, type ReactNode } from "react";
import { Banner } from "@/components/ui/banner";
import { PageHeader } from "@/components/ui/card";
import { phaseOf, type Memo, type Phase, type ShopLive, type StaffLiveShop } from "@/lib/ops";
import type { Shop } from "@/lib/types";
import { clock } from "../../_lib/client";
import { useStaffLive } from "../../_lib/use-staff-live";
import { ShopAlert, type ShopAlertItem } from "./shop-alert";
import { ShopEditor } from "./shop-editor";
import { ShopIntroEditor } from "./shop-intro";
import { MemoDialog, ShopMemo, useMemoAck } from "./shop-memo";
import { ShopReady } from "./shop-ready";
import "./shop.css";

/** お店を「いまの様子」の形に（品物の残りを 品物の id → 残り に） */
function liveOf(s: Shop): StaffLiveShop {
  return { state: s.state, notice: s.notice, stock: Object.fromEntries(s.menu.map((m) => [m.id, m.stock])), hidden: s.hidden, updatedAt: s.updatedAt };
}

/** 品物の形（id を並べたもの）。「いまの様子」と画面で比べて、ほかの所で品物が足された・消されたのに気づく */
const shapeOf = (ids: string[]) => [...ids].sort().join(",");

/** ログインが切れたときの帯（あとから分かることなので、画面に差しこまずに上に重ねる。差しこむと売り切れのボタンが下にずれる） */
const EXPIRED: ShopAlertItem = {
  tone: "ng",
  text: "ログインが切れました。お店の QR を読み直してください",
  more: "いまは押しても保存されません。QR で入れないときは、実行委員から新しい QR をもらってください。書きかけの紹介は、このスマホに残っています。",
};

/**
 * お店の人の画面（/staff）。「いまの様子」を 15 秒ごとに読み直して、ほかのスマホや実行委員が変えた内容も出す。
 * 並びは、ページを開いたときの表示の時期で決める（開いているあいだは並べかえない＝押す所がずれない）：
 *  - 開催前（この 4 週間）：お客さんに見せる準備 → お店の紹介を書く（開いておく）→ 当日に使うボタン（たたむ。「いまはお客さんに出ません」）
 *  - 当日の朝・開催中・終了後：売り切れ → お店の状態 → お店からのお知らせ → 紹介（たたむ）→ 準備（たたむ）
 * あとから届く知らせ（実行委員からの連絡・品物が変わった・表示の時期が変わった）は、上に重ねる帯（ShopAlert）で出す。
 * 「いまの様子」を読めているかの行は高さを決めておく（読めなくなっても、下がずれない）。
 */
export function ShopHome({
  shop: first,
  deptName,
  noticeAt,
  places,
  ops,
  notReady,
}: {
  shop: Shop;
  deptName: string;
  /** いまのお知らせを出した時刻（当日の動きの記録から。分からなければ null） */
  noticeAt: number | null;
  /** 場所の呼び方（ピンの id →「知育館 3階・301 教室」）。開催前の見出しの下と、お客さんに見せる準備の「場所：…」に使う */
  places: Record<string, string>;
  /** phase：ページを開いたときの表示の時期（並びはこれで決める。読み込み直すと新しくなる） */
  ops: { memo: Memo | null; acked: boolean; phase: Phase };
  notReady?: ReactNode;
}) {
  const router = useRouter();
  const [reloading, startReload] = useTransition();
  /** ページの中身（お店・表示の時期）を読み込み直す。書きかけ・押した結果は残る */
  const reload = useCallback(() => startReload(() => router.refresh()), [router]);
  const { live, failed, expired, refresh } = useStaffLive<ShopLive>();
  // 送ったときにログインが切れていると分かった（「いまの様子」の読み直しを待たずに出す）
  const [gone, setGone] = useState(false);
  const onExpired = useCallback(() => setGone(true), []);
  const loggedOut = expired || gone;

  // いちばん新しく分かっているお店：ページ（読み込み直しで新しくなる）と、押した・保存したときの答えの新しいほう
  const [mine, setMine] = useState<Shop | null>(null);
  const shop = mine && mine.updatedAt > first.updatedAt ? mine : first;
  const keep = useCallback((next: Shop) => setMine((cur) => (!cur || next.updatedAt >= cur.updatedAt ? next : cur)), []);
  // 「いまの様子」のほうが新しければ、そちらを出す（ほかのスマホ・実行委員が変えた分）。
  // 比べるのはサーバーの updatedAt（読んだ時刻 live.at ではない）：押す前に読み始めた古い読み直しで、押した結果が戻らないように
  const now = live?.shop && live.shop.updatedAt >= shop.updatedAt ? live.shop : liveOf(shop);
  const placeNames = useMemo(() => new Map(Object.entries(places)), [places]);
  const today = live?.at ?? null;

  // いまのお知らせを出した時刻。お知らせが変わったら、変わったと分かったときの様子の時刻にする
  // （v0.10.0 からは、お知らせを出した時刻がサーバーから届く。それより前のお知らせだけ、ここで見当を付ける）
  const [since, setSince] = useState({ text: first.notice, at: noticeAt });
  if (since.text !== now.notice) setSince({ text: now.notice, at: now.notice ? now.updatedAt : null });
  const noticeSince = now.notice ? (now.noticeAt ?? since.at) : null;

  // 表示の時期：並びはページを開いたとき（ops.phase）、文は「いまの様子」（実行委員が練習で「当日」にしたら、次の読み直しで従い、上の帯で読み込み直しを案内する）
  const layout = ops.phase === "before" ? "before" : "day";
  const phase = live ? phaseOf(live.at, live.phase) : ops.phase;
  const guestsSee = phase === "morning" || phase === "during";
  // 「いまの様子」の行のうしろに足す文（当日の並びでは、押すとお客さんの画面に出るか。2 行ぶんの高さに収まる長さで）
  const tail =
    layout === "before"
      ? "（自動で読み直します）"
      : guestsSee
        ? "。押すと 20 秒ほどでお客さんの画面に出ます"
        : phase === "after"
          ? "。開催は終わりました（押してもお客さんの画面に出ません）"
          : "。いまは押しても、お客さんの画面に出ません";

  // 実行委員からの連絡（読み込んだときはサーバーから、あとは「いまの様子」から）
  const memo = useMemoAck(live ? live.memo : ops.memo, live ? live.acked : ops.acked, live?.at ?? 0, refresh, onExpired);
  const [memoOpen, setMemoOpen] = useState(false);
  const closeMemo = useCallback(() => setMemoOpen(false), []);

  // ほかの所（実行委員・別のスマホ）で品物が足された・消された（名前は「いまの様子」に入っていないので、読み込み直す）
  const itemsChanged = !!live?.shop && live.shop.updatedAt >= shop.updatedAt && shapeOf(Object.keys(live.shop.stock)) !== shapeOf(shop.menu.map((m) => m.id));
  // 表示の時期が、開いたときの並びと合わなくなった（実行委員が練習で切り替えた・日付が変わった）
  const phaseChanged = !!live && (phase === "before") !== (layout === "before");
  const alert: ShopAlertItem | null =
    memo.memo && !memo.done
      ? { tone: "memo", text: "実行委員から連絡があります", action: "見る", onAction: () => setMemoOpen(true) }
      : itemsChanged
        ? { tone: "info", text: "ほかの所でメニューの品物が変わりました", action: "読み込み直す", onAction: reload, pending: reloading }
        : phaseChanged
          ? { tone: "info", text: phase === "before" ? "表示の時期が「開催前」に変わりました" : "表示の時期が「当日」に変わりました", action: "読み込み直す", onAction: reload, pending: reloading }
          : null;

  // 場所（実行委員が決める）。補足は「／」のあとに（かっこを重ねない）
  const placeName = placeNames.get(shop.placeId);
  const where = placeName ? (shop.placeNote ? `${placeName} ／ ${shop.placeNote}` : placeName) : "未定（実行委員が決めます）";

  const editor = (
    <ShopEditor
      shop={shop}
      now={now}
      noticeAt={noticeSince}
      today={today}
      liveAt={live?.at ?? 0}
      failed={failed}
      layout={layout}
      guestsSee={guestsSee}
      onShop={keep}
      onCheck={refresh}
      onExpired={onExpired}
    />
  );
  const intro = (
    <ShopIntroEditor key="intro" shop={shop} layout={layout} today={today} reloading={reloading} onSaved={keep} onReload={reload} onExpired={onExpired} />
  );
  // 並べかえても、紹介の書きかけ（ShopIntroEditor）が消えないよう、key を付けた並びで出す
  const sections =
    layout === "before"
      ? [
          <ShopReady key="ready" shop={shop} places={placeNames} early />,
          intro,
          <details key="day" className="st-intro sh-day">
            <summary className="st-intro-sum">
              <span>当日に使うボタン</span>
              <span className="st-muted">11/28 に使います（売り切れ・お店の状態・お店からのお知らせ）。いまは押しても、お客さんの画面に出ません</span>
            </summary>
            <div className="st-intro-body">{editor}</div>
          </details>,
        ]
      : [
          <div key="day">{editor}</div>,
          intro,
          ops.phase !== "after" && <ShopReady key="ready" shop={shop} places={placeNames} early={false} />,
        ];

  return (
    <>
      <div className="st-page st-stack sh-home">
        <PageHeader
          title={shop.name}
          sub={
            <>
              {deptName}
              {/* 当日は出さない（お店の人はその場所にいる。文字を大きくした小さいスマホで、売り切れのボタンが下のメニューに隠れないように）。
                  場所は「お客さんに見せる準備」にも出る */}
              {layout === "before" && <span className="sh-where">場所：{where}</span>}
            </>
          }
        />
        {notReady}
        <p className={failed && !loggedOut ? "sh-live sh-live--ng" : "sh-live"} role="status">
          {failed && !loggedOut
            ? `電波が弱く、いまの様子を読めていません${live ? `（${clock(live.at)} のまま）` : ""}`
            : live
              ? `${clock(live.at)} の様子${tail}`
              : "いまの様子を読んでいます…"}
        </p>
        {now.hidden && (
          <Banner tone="warning" title="このお店は、いまお客さんの画面に出ていません（実行委員が表示にするまで）">
            書いた内容は保存されます。
          </Banner>
        )}
        {sections}
        <ShopMemo m={memo} today={today} />
      </div>
      {/* 重ねる帯と小窓は、縦に並べる箱（st-stack）の外に（上のあきが付かないように） */}
      <ShopAlert alert={loggedOut ? EXPIRED : alert} />
      <MemoDialog m={memo} open={memoOpen} onClose={closeMemo} today={today} />
    </>
  );
}
