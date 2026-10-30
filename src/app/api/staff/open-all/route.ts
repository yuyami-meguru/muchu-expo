import type { NextRequest } from "next/server";
import { z } from "zod";
import { guarded, needAdmin, ok, readBody } from "@/lib/api";
import { addLiveLog, loadAll, saveLive, type LivePatch } from "@/lib/store";

/** 公開しているお店をまとめて「営業中」にする（実行委員だけ。当日 10:00 用）。品物の残りとお知らせは触らない */
export async function POST(req: NextRequest) {
  return guarded(async () => {
    const no = await needAdmin();
    if (no) return no;
    const b = await readBody(req, z.object({}));
    if ("error" in b) return b.error;
    const { shops } = await loadAll({ fresh: true });
    // 状態の欄だけを 1 回でまとめて書く（同じときにお店が押した売り切れ・お知らせは消えない）
    const targets = shops.filter((shop) => !shop.hidden && shop.state !== "open");
    const changes: Record<string, LivePatch> = Object.fromEntries(targets.map((shop) => [shop.id, { state: "open" as const }]));
    if (targets.length) await saveLive(changes);
    const at = Date.now();
    await addLiveLog(targets.map((shop) => ({ at, by: "admin", shop: shop.id, kind: "state" as const, value: "open" }))).catch((e) => console.error(e));
    return ok({ count: targets.length });
  });
}
