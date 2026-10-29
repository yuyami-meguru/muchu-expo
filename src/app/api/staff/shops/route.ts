import type { NextRequest } from "next/server";
import { z } from "zod";
import { fail, guarded, ok, readBody, zId } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { getShop, loadAll, saveShop, shopKey } from "@/lib/store";
import type { Shop } from "@/lib/types";

/** お店を足す（実行委員だけ）。中身は作ったあとに編集の画面で入れる */
export async function POST(req: NextRequest) {
  return guarded(async () => {
    const s = await getSession();
    if (s?.role !== "admin") return fail(403, "実行委員の合言葉でログインしてください");
    const b = await readBody(
      req,
      z.object({ id: zId, name: z.string().trim().min(1).max(40), dept: z.enum(["taiken", "chaya", "chiiki", "kojin", "unei"]) }),
    );
    if ("error" in b) return b.error;
    if (await getShop(b.data.id, { fresh: true })) return fail(409, "その英字の名前はもう使われています");
    const { shops } = await loadAll({ fresh: true });
    const shop: Shop = {
      ...b.data,
      kind: b.data.dept === "chaya" ? "eat" : b.data.dept === "taiken" ? "play" : "see",
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
      order: Math.max(0, ...shops.map((x) => x.order)) + 10,
      updatedAt: Date.now(),
    };
    await saveShop(shop);
    await shopKey(shop.id);
    return ok({ shop });
  });
}
