"use client";

import { useState, type ReactNode } from "react";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/card";
import type { Memo, ShopLive, StaffLiveShop } from "@/lib/ops";
import type { Shop } from "@/lib/types";
import { clock } from "../../_lib/client";
import { useStaffLive } from "../../_lib/use-staff-live";
import { ShopEditor } from "./shop-editor";
import { ShopIntroEditor } from "./shop-intro";
import { ShopMemo } from "./shop-memo";
import "./shop.css";

/** お店を「いまの様子」の形に（品物の残りを 品物の id → 残り に） */
function liveOf(s: Shop): StaffLiveShop {
  return { state: s.state, notice: s.notice, stock: Object.fromEntries(s.menu.map((m) => [m.id, m.stock])), hidden: s.hidden, updatedAt: s.updatedAt };
}

/**
 * お店の人の画面（/staff）。「いまの様子」を読み直し続けて、ほかのスマホや実行委員が変えた内容も出す。
 * 上から：見出し・読めているか・非表示の知らせ・実行委員からの連絡・状態・売り切れ・お知らせ・紹介。
 * 読み込んだときの連絡はサーバーから受け取る（あとから出てきて、ボタンがずれないように）。
 */
export function ShopHome({
  shop: first,
  deptName,
  noticeAt,
  ops,
  notReady,
}: {
  shop: Shop;
  deptName: string;
  /** いまのお知らせを出した時刻（当日の動きの記録から。分からなければ null） */
  noticeAt: number | null;
  ops: { memo: Memo | null; acked: boolean };
  notReady?: ReactNode;
}) {
  const { live, failed, expired } = useStaffLive<ShopLive>();
  // いちばん新しく分かっているお店（はじめは読み込んだとき、あとは押した・保存したときの答え）
  const [shop, setShop] = useState(first);
  const keep = (next: Shop) => setShop((cur) => (next.updatedAt >= cur.updatedAt ? next : cur));
  // 「いまの様子」のほうが新しければ、そちらを出す（ほかのスマホ・実行委員が変えた分）
  const now = live?.shop && live.at >= shop.updatedAt ? live.shop : liveOf(shop);

  // いまのお知らせを出した時刻。お知らせが変わったら、変わったと分かったときの様子の時刻にする
  // （v0.10.0 からは、お知らせを出した時刻がサーバーから届く。それより前のお知らせだけ、ここで見当を付ける）
  const [since, setSince] = useState({ text: first.notice, at: noticeAt });
  if (since.text !== now.notice) setSince({ text: now.notice, at: now.notice ? now.updatedAt : null });
  const noticeSince = now.notice ? (now.noticeAt ?? since.at) : null;

  const { memo, acked } = live ?? ops;

  return (
    <div className="st-page st-stack">
      <PageHeader
        title={shop.name}
        sub={`${deptName} ・ 押すと 20 秒ほどでお客さんの画面に出ます`}
        actions={
          !now.hidden && (
            <Button href={`/shops/${shop.id}`} target="_blank" rel="noopener" variant="secondary" size="sm" icon="外へ">
              お客さんの画面で見る<span className="sr-only">（新しいタブで開きます）</span>
            </Button>
          )
        }
      />
      {notReady}
      <p className={failed || expired ? "sh-live sh-live--ng" : "sh-live"} role={failed || expired ? "alert" : undefined}>
        {expired
          ? "ログインが切れました（QR が新しく作り直されたなど）。押しても保存されません。お店の QR をもう一度カメラで読み取ってください"
          : failed
          ? `いまの様子を読めていません${live ? `（${clock(live.at)} のままです）` : ""}。電波のよい所に移ってください。押した結果は、押した所に出ます`
          : live
            ? `${clock(live.at)} の様子です（自動で読み直します）`
            : "いまの様子を読んでいます…"}
      </p>
      {now.hidden && (
        <Banner tone="warning" title="このお店は、いまお客さんの画面に出ていません（実行委員が表示にするまで）">
          書いた内容は保存されます。
        </Banner>
      )}
      <ShopMemo memo={memo} acked={acked} />
      <ShopEditor shop={shop} now={now} noticeAt={noticeSince} onShop={keep} />
      <ShopIntroEditor shop={first} onSaved={keep} />
    </div>
  );
}
