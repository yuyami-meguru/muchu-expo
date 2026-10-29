import type { Metadata } from "next";
import { Icon } from "@/components/icons";
import { PageHeader } from "@/components/ui/card";
import { ListRow, RowList } from "@/components/ui/list-row";
import { ADMIN_GROUPS } from "@/components/shell";
import { adminOnly } from "../_components/admin-only";

export const metadata: Metadata = { title: "その他" };

/** スマホの下のメニューに入りきらない画面（AVERIX の「その他」と同じ形） */
export default async function StaffMorePage() {
  await adminOnly();
  return (
    <div className="st-page st-stack">
      <PageHeader title="その他" />
      {ADMIN_GROUPS.map((g) => (
        <section key={g.label} aria-label={g.label}>
          <h2 className="st-muted" style={{ fontSize: "0.85rem" }}>
            {g.label}
          </h2>
          <RowList>
            {g.items.map((i) => (
              <ListRow key={i.key} title={i.label} href={i.href} icon={i.icon} chevron />
            ))}
          </RowList>
        </section>
      ))}
      <p className="st-muted">
        <Icon name="情報" size={16} /> ログアウトは、各画面のいちばん下にあります
      </p>
    </div>
  );
}
