import type { Metadata } from "next";
import { Banner } from "@/components/ui/banner";
import { PageHeader } from "@/components/ui/card";
import { parsePhaseMode, phaseOf } from "@/lib/ops";
import { loadChecks } from "@/lib/ops-server";
import { getSetting, loadAll, storeReady } from "@/lib/store";
import { adminOnly } from "../_components/admin-only";
import { ToolsPanel } from "./tools-panel";

export const metadata: Metadata = { title: "当日の道具" };
export const dynamic = "force-dynamic";

/** いまの時刻（サーバー。ページを開くたびに 1 回だけ読む）。表示の時期を決めるのに使う */
const serverNow = () => Date.now();

/**
 * 当日の朝・終わり・前日に使う道具（実行委員だけ）：
 * 朝の順（控え → まとめて戻す → 全部を営業中）、終わりの時間、表示の時期、当日のチェックリスト、データの控え
 */
export default async function StaffToolsPage() {
  await adminOnly();
  const ready = storeReady();
  const [{ shops }, checks, phase] = await Promise.all([loadAll({ fresh: true }), loadChecks(), getSetting("phase")]);
  const visible = shops.filter((s) => !s.hidden);
  const summary = {
    shops: visible.length,
    open: visible.filter((s) => s.state === "open").length,
    out: visible.reduce((n, s) => n + s.menu.filter((m) => m.stock !== "on").length, 0),
    notices: visible.filter((s) => s.notice).length,
  };
  const mode = parsePhaseMode(phase);
  return (
    <div className="st-page st-stack">
      <PageHeader title="当日の道具" sub="前日の練習のあと・当日の朝と終わりに、全部のお店の状態をまとめて切り替えます" />
      {!ready && (
        <Banner tone="error" title="保存先（Upstash）がまだつながっていません">
          いまは見本のデータを出しているだけなので、この画面のボタンは使えません。Vercel で Upstash をつないでください。
        </Banner>
      )}
      <ToolsPanel
        ready={ready}
        summary={summary}
        shops={shops.map((s) => ({ id: s.id, name: s.name }))}
        checks={checks}
        phase={{ mode, now: phaseOf(serverNow(), mode) }}
      />
    </div>
  );
}
