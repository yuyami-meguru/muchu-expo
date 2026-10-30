import type { Metadata } from "next";
import { Banner } from "@/components/ui/banner";
import { PageHeader } from "@/components/ui/card";
import { phaseOf } from "@/lib/ops";
import { loadChecks } from "@/lib/ops-server";
import { loadAll, storeReady } from "@/lib/store";
import { adminOnly } from "../_components/admin-only";
import { loadAdminOps, serverNow } from "../_components/staff-settings";
import { CLOSING_NEWS } from "./tool-text";
import { ToolsPanel } from "./tools-panel";

export const metadata: Metadata = { title: "当日の道具" };
export const dynamic = "force-dynamic";

/**
 * 当日の朝・終わり・前日に使う道具（実行委員だけ）：
 * 朝の順（控え → まとめて戻す → 試しの分を消す → 表示の時期 → 点呼 → 10:00 に全部を営業中）、終わりの時間、表示の時期、当日のチェックリスト、データの控え。
 * 運営の設定（表示の時期・全体の帯・連絡・ラジオ）は、上の帯（枠）と同じ 1 回の読み込みを使う
 */
export default async function StaffToolsPage() {
  await adminOnly("/staff/tools");
  const ready = storeReady();
  const [{ shops, news }, checks, ops] = await Promise.all([loadAll({ fresh: true }), loadChecks(), loadAdminOps()]);
  const visible = shops.filter((s) => !s.hidden);
  const summary = {
    shops: visible.length,
    open: visible.filter((s) => s.state === "open").length,
    out: visible.reduce((n, s) => n + s.menu.filter((m) => m.stock !== "on").length, 0),
    notices: visible.filter((s) => s.notice).length,
  };
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
        shops={shops.map((s) => ({ id: s.id, name: s.name, hidden: s.hidden }))}
        checks={checks}
        phase={{ mode: ops.phase, now: phaseOf(serverNow(), ops.phase), until: ops.phaseUntil }}
        ops={{ alert: ops.alert, memo: ops.memo, onAir: ops.radio.onAir }}
        closingPosted={news.some((n) => n.text === CLOSING_NEWS)}
      />
    </div>
  );
}
