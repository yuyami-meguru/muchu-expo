import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/card";
import { loadAll } from "@/lib/store";
import { adminOnly } from "../_components/admin-only";
import { PlacesEditor } from "./places-editor";
import { ShopPlaces } from "./shop-places";

export const metadata: Metadata = { title: "地図のピン" };
export const dynamic = "force-dynamic";

export default async function StaffPlacesPage() {
  await adminOnly();
  const { places, shops, areas, depts } = await loadAll({ fresh: true });
  const counts = Object.fromEntries(places.map((p) => [p.id, shops.filter((s) => s.placeId === p.id).length]));
  return (
    <div className="st-page st-stack">
      <PageHeader
        title="地図のピン"
        sub="上のボタンで「外」とフロアを切り替えます。ピンを選んで、地図で場所を押してから［ここに動かす］を押すと動きます。フロアの部屋は四角で置けます。トイレ・受付・救護などのピンも置けます。どのお店をどこにするかは、いちばん下の「お店の場所を決める」でまとめて選べます"
        actions={
          <Button href="#shop-places" size="sm" icon="場所" iconRight="下へ">
            お店の場所を決める
          </Button>
        }
      />
      <PlacesEditor places={places} areas={areas} counts={counts} />
      <ShopPlaces shops={shops} places={places} areas={areas} depts={depts} />
    </div>
  );
}
