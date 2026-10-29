import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/card";
import { loadAll } from "@/lib/store";
import { adminOnly } from "../_components/admin-only";
import { NewsEditor } from "./news-editor";

export const metadata: Metadata = { title: "お知らせ" };
export const dynamic = "force-dynamic";

export default async function StaffNewsPage() {
  await adminOnly();
  const { news } = await loadAll({ fresh: true });
  return (
    <div className="st-page st-stack">
      <PageHeader title="お知らせ" sub="お客さんの画面のトップに出ます（15 秒ほどで届きます）" />
      <NewsEditor news={news} />
    </div>
  );
}
