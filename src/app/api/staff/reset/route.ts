import type { NextRequest } from "next/server";
import { z } from "zod";
import { fail, guarded, ok, readBody } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { loadAll, saveLive, type LivePatch } from "@/lib/store";

/**
 * 売り切れと状態をまとめて戻す（実行委員だけ）。前日の練習のあとや、当日の朝に使う。
 * 全部のお店：品物はすべて「販売中」、状態は「準備中」、お店からのお知らせは空。
 * 押しまちがいを防ぐため、中身に {confirm:"リセット"} が要る。
 */
export async function POST(req: NextRequest) {
  return guarded(async () => {
    const s = await getSession();
    if (s?.role !== "admin") return fail(403, "実行委員の合言葉でログインしてください");
    const b = await readBody(req, z.object({ confirm: z.literal("リセット") }));
    if ("error" in b) return b.error;
    const { shops } = await loadAll({ fresh: true });
    const changes: Record<string, LivePatch> = Object.fromEntries(
      shops.map((shop) => [shop.id, { state: "prep" as const, notice: "", stock: Object.fromEntries(shop.menu.map((m) => [m.id, "on" as const])) }]),
    );
    await saveLive(changes);
    return ok({ count: shops.length });
  });
}
