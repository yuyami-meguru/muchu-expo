import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { loadAll } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { shops } = await loadAll();
  const fixed = ["", "/shops", "/schedule", "/map", "/info"].map((p) => ({ url: `${SITE_URL}${p}` }));
  return [...fixed, ...shops.filter((s) => !s.hidden).map((s) => ({ url: `${SITE_URL}/shops/${s.id}` }))];
}
