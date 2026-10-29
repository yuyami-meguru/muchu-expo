import type { Metadata } from "next";
import { Banner } from "@/components/ui/banner";
import { PageHeader } from "@/components/ui/card";
import { loadAll, storeReady } from "@/lib/store";
import { adminOnly } from "../_components/admin-only";
import { ToolsPanel } from "./tools-panel";

export const metadata: Metadata = { title: "当日の道具" };
export const dynamic = "force-dynamic";

/** 当日の朝・前日に使う道具（実行委員だけ）：まとめて営業中・まとめて戻す・データの控え */
export default async function StaffToolsPage() {
  await adminOnly();
  const ready = storeReady();
  const { shops } = await loadAll({ fresh: true });
  const visible = shops.filter((s) => !s.hidden);
  const summary = {
    shops: visible.length,
    open: visible.filter((s) => s.state === "open").length,
    out: visible.reduce((n, s) => n + s.menu.filter((m) => m.stock !== "on").length, 0),
    notices: visible.filter((s) => s.notice).length,
  };
  return (
    <div className="st-page st-stack">
      <PageHeader title="当日の道具" sub="前日の練習のあと・当日の朝に、全部のお店をまとめて動かします" />
      {!ready && (
        <Banner tone="error" title="保存先（Upstash）がまだつながっていません">
          いまは見本のデータを出しているだけなので、この画面のボタンは使えません。Vercel で Upstash をつないでください。
        </Banner>
      )}
      <ToolsPanel ready={ready} summary={summary} />
    </div>
  );
}
