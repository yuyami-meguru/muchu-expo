import type { Metadata } from "next";
import { cache } from "react";
import { PageHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { getSession } from "@/lib/auth";
import { getShop, loadAll } from "@/lib/store";
import { adminOnly } from "../../_components/admin-only";
import { ShopForm } from "./shop-form";

export const dynamic = "force-dynamic";

/** タブの名前と画面で、同じ 1 回の読み込みを使う */
const loadShop = cache((id: string) => getShop(id, { fresh: true }));

/**
 * タブの名前：「焼きそばを編集」（いくつも開いていても見分けられるように）。
 * 店名は実行委員にだけ出す。ログインなし・お店の人は入口や自分の画面へ回されるが、その返事の <title> にも
 * 店名が入るので（非表示のお店の名前や、どの id があるかが分かってしまう）、決まった題名にする
 */
export async function generateMetadata({ params }: PageProps<"/staff/shops/[id]">): Promise<Metadata> {
  const s = await getSession();
  if (s?.role !== "admin") return { title: "お店を編集" };
  const { id } = await params;
  const shop = await loadShop(id);
  return { title: shop ? `${shop.name}を編集` : "お店が見つかりません" };
}

export default async function StaffShopEditPage({ params, searchParams }: PageProps<"/staff/shops/[id]">) {
  const { id } = await params;
  await adminOnly(`/staff/shops/${id}`);
  const shop = await loadShop(id);
  // 消したお店（ほかの人が消した・古いリンク）。お客さん向けの「見つかりません」ではなく、従業員の画面の中で戻り先を出す
  if (!shop) {
    return (
      <div className="st-page st-stack">
        <PageHeader title="お店を編集" />
        <EmptyState
          title="このお店は見つかりません"
          action={
            <Button href="/staff/shops" icon="一覧">
              お店の情報へ戻る
            </Button>
          }
        >
          ほかの人が消したか、古いリンクかもしれません。「お店の情報」の一覧から選び直してください。
        </EmptyState>
      </div>
    );
  }
  const { places, areas, depts, shops } = await loadAll();
  const added = (await searchParams).added === "1";
  // 場所ごとの、このお店のほかにいるお店の数（場所を選ぶ欄に「（ほかに 1 店）」と出す）
  const placeCount: Record<string, number> = {};
  for (const s of shops) if (s.id !== shop.id && s.placeId) placeCount[s.placeId] = (placeCount[s.placeId] ?? 0) + 1;
  return (
    <div className="st-page st-stack">
      <PageHeader
        title={shop.name}
        sub="変えたら、いちばん下の［保存］を押してください"
        actions={
          // 新しいタブで開く（書きかけの入力を消さないため）
          <Button href={`/shops/${shop.id}`} target="_blank" rel="noopener noreferrer" variant="secondary" size="sm" icon="外へ">
            お客さんの画面
          </Button>
        }
      />
      <ShopForm shop={shop} places={places} areas={areas} depts={depts} placeCount={placeCount} added={added} />
    </div>
  );
}
