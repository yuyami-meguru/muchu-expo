import type { NextRequest } from "next/server";
import { z } from "zod";
import { guarded, needAdmin, ok, readBody } from "@/lib/api";
import { addLiveLog, loadAll, saveLive, type LivePatch } from "@/lib/store";

/** 公開しているお店をまとめて「終了」にする（実行委員だけ。14:00 用）。品物の残りとお知らせは触らない */
export async function POST(req: NextRequest) {
  return guarded(async () => {
    const no = await needAdmin();
    if (no) return no;
    const b = await readBody(req, z.object({}));
    if ("error" in b) return b.error;
    const { shops } = await loadAll({ fresh: true });
    const targets = shops.filter((shop) => !shop.hidden && shop.state !== "closed");
    const changes: Record<string, LivePatch> = Object.fromEntries(targets.map((shop) => [shop.id, { state: "closed" as const }]));
    if (targets.length) await saveLive(changes);
    const at = Date.now();
    await addLiveLog(targets.map((shop) => ({ at, by: "admin", shop: shop.id, kind: "state" as const, value: "closed" }))).catch((e) => console.error(e));
    return ok({ count: targets.length });
  });
}
