import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getShop, loadAll } from "@/lib/store";
import { adminOnly } from "../../_components/admin-only";
import { ShopForm } from "./shop-form";

export const metadata: Metadata = { title: "お店を編集" };
export const dynamic = "force-dynamic";

export default async function StaffShopEditPage({ params }: PageProps<"/staff/shops/[id]">) {
  await adminOnly();
  const { id } = await params;
  const shop = await getShop(id, { fresh: true });
  if (!shop) notFound();
  const { places, depts } = await loadAll();
  return (
    <div className="st-page st-stack">
      <PageHeader
        title={shop.name}
        sub="変えたら、いちばん下の「保存」を押してください"
        actions={
          // 新しいタブで開く（書きかけの入力を消さないため）
          <Button href={`/shops/${shop.id}`} target="_blank" rel="noopener noreferrer" variant="secondary" size="sm" icon="外へ">
            お客さんの画面
          </Button>
        }
      />
      <ShopForm shop={shop} places={places} depts={depts} />
    </div>
  );
}
