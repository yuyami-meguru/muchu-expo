import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui/card";
import { Icon } from "@/components/icons";
import { loadAll } from "@/lib/store";
import { deptLookup, STATE_LABEL } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { adminOnly } from "../_components/admin-only";
import { NewShopForm } from "./new-shop-form";

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
        sub="名前・説明・メニューと値段・当日の流れ・お店の思い・場所を変えられます"
        actions={
          <Button href="/staff/depts" icon="直す">
            部門を編集
          </Button>
        }
      />
      <ul className="st-list">
        {shops.map((s) => (
          <li key={s.id}>
            <Link href={`/staff/shops/${s.id}`} className={`st-list-row tone-${dept(s.dept).color}`}>
              <span className="st-dot" aria-hidden="true" />
              <span className="st-grow">
                <strong>{s.name}</strong>
                <br />
                <span className="st-muted">
                  {dept(s.dept).name} ・ {s.placeId ? placeName.get(s.placeId) ?? "場所なし" : "場所は未定"} ・ 品物 {s.menu.length}
                </span>
              </span>
              <span className="st-badge" data-v={s.state}>
                {s.hidden ? "非公開" : STATE_LABEL[s.state]}
              </span>
              <Icon name="右へ" size={20} />
            </Link>
          </li>
        ))}
      </ul>
      <NewShopForm depts={depts} />
    </div>
  );
}
