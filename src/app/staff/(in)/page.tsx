import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Banner } from "@/components/ui/banner";
import { PageHeader } from "@/components/ui/card";
import { getSession } from "@/lib/auth";
import { getShop, loadAll, storeReady } from "@/lib/store";
import { DEPTS } from "@/lib/types";
import { AdminOverview } from "./_components/admin-overview";
import { ShopEditor } from "./_components/shop-editor";

export const metadata: Metadata = { title: "いまの様子" };
export const dynamic = "force-dynamic";

export default async function StaffHome() {
  const s = await getSession();
  if (!s) redirect("/staff/login");
  const ready = storeReady();
  const notReady = !ready && (
    <Banner tone="error" title="保存先（Upstash）がまだつながっていません">
      いまは見本のデータを出しているだけで、変えても保存されません。Vercel で Upstash をつないでください。
    </Banner>
  );

  if (s.role === "shop") {
    const shop = await getShop(s.shop, { fresh: true });
    if (!shop) redirect("/staff/login");
    return (
      <div className="st-page st-stack">
        <PageHeader title={shop.name} sub={`${DEPTS[shop.dept].name} ・ 押すとすぐお客さんの画面に出ます`} />
        {notReady}
        <ShopEditor shop={shop} />
      </div>
    );
  }

  const { shops } = await loadAll({ fresh: true });
  return (
    <div className="st-page st-page--wide st-stack">
      <PageHeader title="いまの様子" sub="札を押すと「販売中 → 残りわずか → 売り切れ」の順に変わります" />
      {notReady}
      <AdminOverview shops={shops} />
    </div>
  );
}
