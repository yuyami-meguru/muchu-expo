import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/card";
import { loadAll } from "@/lib/store";
import { adminOnly } from "../_components/admin-only";
import { DeptsEditor } from "./depts-editor";

export const metadata: Metadata = { title: "部門" };
export const dynamic = "force-dynamic";

/** 部門を足す・消す・名前や色・並び順を変える（実行委員だけ） */
export default async function StaffDeptsPage() {
  await adminOnly("/staff/depts");
  const { depts, shops } = await loadAll({ fresh: true });
  const counts = Object.fromEntries(depts.map((d) => [d.id, shops.filter((s) => s.dept === d.id).map((s) => s.name)]));
  return (
    <div className="st-page st-stack">
      <PageHeader title="部門" sub="名前・色・並び順を変えると、お客さんの画面（一覧・地図・ホーム）にすぐ出ます。お店をどの部門に入れるかは、「お店の情報」でお店の名前を押して選びます" />
      <DeptsEditor depts={depts} shopsIn={counts} />
    </div>
  );
}
