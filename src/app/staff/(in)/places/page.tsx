import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/card";
import { loadAll } from "@/lib/store";
import { adminOnly } from "../_components/admin-only";
import { PlacesEditor } from "./places-editor";

export const metadata: Metadata = { title: "地図のピン" };
export const dynamic = "force-dynamic";

export default async function StaffPlacesPage() {
  await adminOnly();
  const { places, shops } = await loadAll({ fresh: true });
  const counts = Object.fromEntries(places.map((p) => [p.id, shops.filter((s) => s.placeId === p.id).length]));
  return (
    <div className="st-page st-stack">
      <PageHeader
        title="地図のピン"
        sub="ピンを選んで、地図で場所を押してから［ここに動かす］を押すと動きます。トイレ・受付・救護などのピンも置けます。お店とピンのつなぎ方は「お店の情報」で"
      />
      <PlacesEditor places={places} counts={counts} />
    </div>
  );
}
