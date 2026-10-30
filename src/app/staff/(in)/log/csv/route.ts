import type { NextRequest } from "next/server";
import { fail } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { listLiveLog, loadAll } from "@/lib/store";
import { dayKey, namesOf, toCsv } from "../live-log";

export const dynamic = "force-dynamic";

/**
 * 当日の動きの表（CSV。実行委員だけ）。?day=2026-11-28（all ですべての日）・?shop=お店の id で絞れる。
 * Excel で開けるよう BOM 付き。式として動く値（= + - @ で始まる）には ' を付ける。
 */
export async function GET(req: NextRequest) {
  const s = await getSession();
  if (s?.role !== "admin") return fail(403, "実行委員の合言葉でログインしてください");
  const asked = req.nextUrl.searchParams.get("day") ?? "";
  const day = /^\d{4}-\d{2}-\d{2}$/.test(asked) ? asked : "all";
  const shop = req.nextUrl.searchParams.get("shop") ?? "";
  const [{ shops }, moves] = await Promise.all([loadAll({ fresh: true }), listLiveLog()]);
  const list = moves.filter((e) => (day === "all" || dayKey(e.at) === day) && (!shop || e.shop === shop));
  const name = `muchu-livelog-${day === "all" ? "all" : day.replace(/-/g, "")}${shop && /^[a-z0-9-]{1,40}$/.test(shop) ? `-${shop}` : ""}.csv`;
  return new Response(toCsv(list, namesOf(shops)), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
