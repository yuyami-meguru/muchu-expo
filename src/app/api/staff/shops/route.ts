import type { NextRequest } from "next/server";
import { z } from "zod";
import { fail, guarded, needAdmin, ok, readBody, zId, zKind } from "@/lib/api";
import { getShop, loadAll, saveShop, shopKey } from "@/lib/store";
import type { Shop } from "@/lib/types";

/**
 * お店を足す（実行委員だけ）。中身は作ったあとに編集の画面で入れる。
 * kind（「何したい？」の分け方：eat・play・see）は任意。無ければ「見る・聴く」（v0.11 までと同じ）
 */
export async function POST(req: NextRequest) {
  return guarded(async () => {
    const no = await needAdmin();
    if (no) return no;
    const b = await readBody(req, z.object({ id: zId, name: z.string().trim().min(1).max(40), dept: zId, kind: zKind.optional() }), {
      labels: { name: "お店の名前" },
    });
    if ("error" in b) return b.error;
    if (await getShop(b.data.id, { fresh: true })) return fail(409, "その英字の名前はもう使われています");
    const { shops, depts } = await loadAll({ fresh: true });
    if (!depts.some((d) => d.id === b.data.dept)) return fail(400, "その部門はありません");
    const shop: Shop = {
      id: b.data.id,
      name: b.data.name,
      dept: b.data.dept,
      kind: b.data.kind ?? "see",
      catch: "",
      description: "",
      message: "",
      placeId: "",
      placeNote: "",
      menu: [],
      schedule: [],
      state: "prep",
      notice: "",
      hidden: true,
      order: Math.min(9999, Math.max(0, ...shops.map((x) => x.order)) + 10),
      updatedAt: Date.now(),
    };
    const saved = await saveShop(shop);
    await shopKey(shop.id);
    return ok({ shop: saved });
  });
}
