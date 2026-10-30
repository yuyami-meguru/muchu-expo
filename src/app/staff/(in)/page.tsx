import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Banner } from "@/components/ui/banner";
import { PageHeader } from "@/components/ui/card";
import { getSession } from "@/lib/auth";
import { loadCalls, loadMemo, loadMemoAcks } from "@/lib/ops-server";
import { getShop, listLiveLog, loadAll, storeReady } from "@/lib/store";
import { deptLookup } from "@/lib/types";
import { AdminOverview } from "./_components/admin-overview";
import { ShopHome } from "./_components/shop-home";

export const dynamic = "force-dynamic";

/** タブの名前：お店の人は自分のお店の名前（画面の見出しと同じ）、実行委員は「いまの様子」 */
export async function generateMetadata(): Promise<Metadata> {
  const s = await getSession();
  const shop = s?.role === "shop" ? await getShop(s.shop) : null;
  return { title: shop?.name ?? "いまの様子" };
}

export default async function StaffHome() {
  const s = await getSession();
  if (!s) redirect("/staff/login?from=expired");
  const ready = storeReady();
  const notReady = !ready && (
    <Banner tone="error" title="保存先（Upstash）がまだつながっていません">
      いまは見本のデータを出しているだけで、変えても保存されません。Vercel で Upstash をつないでください。
    </Banner>
  );

  if (s.role === "shop") {
    // 呼び出し・実行委員からの連絡も、はじめから出しておく（あとから出てきて、ボタンがずれないように）
    const [shop, { depts }, calls, memo, acks, moves] = await Promise.all([
      getShop(s.shop, { fresh: true }),
      loadAll(),
      loadCalls(s.shop),
      loadMemo(),
      loadMemoAcks(),
      listLiveLog(200).catch(() => []),
    ]);
    if (!shop) redirect("/staff/login?from=expired");
    // いま出ているお知らせを出した時刻（当日の動きの記録で、いちばん新しいお知らせの切り替え。文がちがえば分からないので出さない）
    const last = moves.find((m) => m.shop === shop.id && m.kind === "notice");
    const noticeAt = shop.noticeAt ?? (shop.notice && last?.value === shop.notice ? last.at : null);
    return (
      <ShopHome
        shop={shop}
        deptName={deptLookup(depts)(shop.dept).name}
        noticeAt={noticeAt}
        ops={{ calls, memo, acked: !!memo && acks[shop.id] === memo.id }}
        notReady={notReady}
      />
    );
  }

  const { shops, depts } = await loadAll({ fresh: true });
  return (
    <div className="st-page st-page--wide st-stack">
      <PageHeader title="いまの様子" sub="札を押すと「販売中 → 残りわずか → 売り切れ」の順に変わります" />
      {notReady}
      <AdminOverview shops={shops} depts={depts} />
    </div>
  );
}
