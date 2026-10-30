import type { Metadata } from "next";
import { Banner } from "@/components/ui/banner";
import { PageHeader } from "@/components/ui/card";
import { parseAlert } from "@/lib/ops";
import { loadMemo, loadMemoAcks } from "@/lib/ops-server";
import { getSetting, loadAll, storeReady } from "@/lib/store";
import { adminOnly } from "../_components/admin-only";
import { NewsBoard } from "./news-board";

export const metadata: Metadata = { title: "全体のお知らせ" };
export const dynamic = "force-dynamic";

/** 全体のお知らせ（トップに出す）・全体の帯（雨・急ぎ）・お店の人への連絡（実行委員だけ） */
export default async function StaffNewsPage() {
  await adminOnly();
  const [{ news, shops }, alert, memo, acks] = await Promise.all([loadAll({ fresh: true }), getSetting("alert"), loadMemo(), loadMemoAcks()]);
  const ready = storeReady();
  return (
    <div className="st-page st-stack">
      <PageHeader title="全体のお知らせ" sub="お客さんの画面のトップに出ます（15 秒ほどで届きます）。雨・急ぎの帯と、お店の人への連絡もここから出せます" />
      {!ready && (
        <Banner tone="error" title="保存先（Upstash）がまだつながっていません">
          いまは見本のデータを出しているだけなので、この画面のボタンは使えません。
        </Banner>
      )}
      <NewsBoard
        news={news}
        alert={parseAlert(alert)}
        memo={memo}
        acks={acks}
        shops={shops.filter((s) => !s.hidden).map((s) => ({ id: s.id, name: s.name }))}
        ready={ready}
      />
    </div>
  );
}
