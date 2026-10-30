import type { Metadata } from "next";
import { Banner } from "@/components/ui/banner";
import { PageHeader } from "@/components/ui/card";
import { phaseOf } from "@/lib/ops";
import { loadMemoAcks } from "@/lib/ops-server";
import { loadAll, storeReady } from "@/lib/store";
import { adminOnly } from "../_components/admin-only";
import { loadAdminOps, serverNow } from "../_components/staff-settings";
import { NewsBoard } from "./news-board";

export const metadata: Metadata = { title: "全体のお知らせ" };
export const dynamic = "force-dynamic";

/** 全体のお知らせ（ホームに出す）・全体の帯（雨・急ぎ）・お店の人への連絡（実行委員だけ） */
export default async function StaffNewsPage() {
  await adminOnly("/staff/news");
  // 全体の帯・お店の人への連絡・表示の時期は、上の帯（枠）と同じ 1 回の読み込み（loadAdminOps）
  const [{ news, shops }, acks, ops] = await Promise.all([loadAll({ fresh: true }), loadMemoAcks(), loadAdminOps()]);
  const now = serverNow();
  const ready = storeReady();
  return (
    <div className="st-page st-stack">
      <PageHeader
        title="全体のお知らせ"
        sub="お知らせは、お客さんの画面のホームに出ます（当日は 20 秒ほどで届きます）。雨・急ぎの帯と、お店の人への連絡もここから出せます"
      />
      {!ready && (
        <Banner tone="error" title="保存先（Upstash）がまだつながっていません">
          いまは見本のデータを出しているだけなので、この画面のボタンは使えません。
        </Banner>
      )}
      <NewsBoard
        news={news}
        alert={ops.alert}
        memo={ops.memo}
        acks={acks}
        shops={shops.filter((s) => !s.hidden).map((s) => ({ id: s.id, name: s.name }))}
        ready={ready}
        at={now}
        phase={phaseOf(now, ops.phase)}
      />
    </div>
  );
}
