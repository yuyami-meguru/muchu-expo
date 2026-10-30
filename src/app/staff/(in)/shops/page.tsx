import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/card";
import { phaseOf } from "@/lib/ops";
import { readinessOf } from "@/lib/readiness";
import { loadAll } from "@/lib/store";
import { deptLookup, placeLabeler } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { adminOnly } from "../_components/admin-only";
import { loadAdminOps, serverNow } from "../_components/staff-settings";
import { everyText } from "../ops-result";
import { NewShopForm } from "./new-shop-form";
import { ShopQuickList } from "./quick-list";

export const metadata: Metadata = { title: "お店の情報" };
export const dynamic = "force-dynamic";

/**
 * お店の情報（実行委員だけ）：いちばん上に［＋ お店を足す］（たたんである）、その下に、部門ごとのお店の一覧。
 * 一覧では、名前で探す・しぼり込み（準備がまだ・場所が未定・非表示・「準備中」のまま・売り切れあり）ができる
 */
export default async function StaffShopsPage() {
  await adminOnly("/staff/shops");
  // 表示の時期は、上の帯（枠）と同じ 1 回の読み込み（読み直しの間隔の文に使う）
  const [{ shops, places, areas, depts }, ops] = await Promise.all([loadAll({ fresh: true }), loadAdminOps()]);
  const phase = phaseOf(serverNow(), ops.phase);
  const dept = deptLookup(depts);
  const where = placeLabeler(areas);
  const placeName = new Map(places.map((p) => [p.id, where(p)]));
  return (
    <div className="st-page st-stack">
      <PageHeader
        title="お店の情報"
        sub={`営業の状態・品物の売り切れ・お客さんの画面に出すかは、ここで押すとすぐ変わります（お店の人が押した分も ${everyText(phase)}に入ります）。名前・メニュー・場所は、お店の名前を押して直します`}
        actions={
          <div className="st-row">
            <Button href="/staff/places#shop-places" size="sm" icon="場所">
              お店の場所を決める
            </Button>
            <Button href="/staff/depts" size="sm" icon="直す">
              部門を編集
            </Button>
          </div>
        }
      />
      <NewShopForm depts={depts} />
      <ShopQuickList
        depts={depts}
        phase={phase}
        rows={shops.map((s) => ({
          shop: s,
          deptName: dept(s.dept).name,
          color: dept(s.dept).color,
          placeName: s.placeId ? (placeName.get(s.placeId) ?? "場所なし（消したピン）") : "場所は未定",
          ready: readinessOf(s, placeName),
        }))}
      />
    </div>
  );
}
