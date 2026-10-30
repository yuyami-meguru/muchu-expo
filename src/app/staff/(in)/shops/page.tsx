import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/card";
import { loadAll } from "@/lib/store";
import { deptLookup } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { adminOnly } from "../_components/admin-only";
import { NewShopForm } from "./new-shop-form";
import { ShopQuickList } from "./quick-list";

export const metadata: Metadata = { title: "お店の情報" };
export const dynamic = "force-dynamic";

export default async function StaffShopsPage() {
  await adminOnly();
  const { shops, places, depts } = await loadAll({ fresh: true });
  const dept = deptLookup(depts);
  const placeName = new Map(places.map((p) => [p.id, p.name]));
  return (
    <div className="st-page st-stack">
      <PageHeader
        title="お店の情報"
        sub="営業の状態・売り切れ・非表示は、ここで押すとすぐ変わります。名前・メニュー・場所などは、お店の名前を押して編集"
        actions={
          <Button href="/staff/depts" icon="直す">
            部門を編集
          </Button>
        }
      />
      <ShopQuickList
        rows={shops.map((s) => ({
          shop: s,
          deptName: dept(s.dept).name,
          color: dept(s.dept).color,
          placeName: s.placeId ? placeName.get(s.placeId) ?? "場所なし" : "場所は未定",
        }))}
      />
      <NewShopForm depts={depts} />
    </div>
  );
}
