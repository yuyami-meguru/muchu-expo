import type { NextRequest } from "next/server";
import { adminShopPatch, fail, guarded, ok, readBody, sameOrigin, shopPatch } from "@/lib/api";
import { canEditShop, getSession } from "@/lib/auth";
import { deleteShop, getShop, saveShop } from "@/lib/store";
import type { Shop } from "@/lib/types";

/*
 * お店を書き換える。
 *  - お店の人：自分のお店の「状態・お知らせ・品物ごとの残り」だけ（ほかの欄は送っても捨てる）
 *  - 実行委員：すべての欄
 * ほかのお店は、ここ（サーバー）で断る。
 */
export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/staff/shops/[id]">) {
  return guarded(async () => {
    const { id } = await ctx.params;
    const s = await getSession();
    if (!s) return fail(401, "ログインしてください");
    if (!canEditShop(s, id)) return fail(403, "このお店は編集できません");
    const b = await readBody(req, s.role === "admin" ? adminShopPatch : shopPatch);
    if ("error" in b) return b.error;
    const shop = await getShop(id, { fresh: true });
    if (!shop) return fail(404, "お店が見つかりません");

    const { stock, ...rest } = b.data as typeof b.data & Partial<Shop>;
    const next: Shop = { ...shop, ...rest };
    if (stock?.length) {
      const by = new Map(stock.map((x) => [x.id, x.stock]));
      next.menu = next.menu.map((m) => (by.has(m.id) ? { ...m, stock: by.get(m.id)! } : m));
    }
    await saveShop(next);
    return ok({ shop: { ...next, updatedAt: Date.now() } });
  });
}

/** お店を消す（実行委員だけ） */
export async function DELETE(req: NextRequest, ctx: RouteContext<"/api/staff/shops/[id]">) {
  return guarded(async () => {
    if (!sameOrigin(req)) return fail(403, "このサイトの画面から操作してください");
    const s = await getSession();
    if (s?.role !== "admin") return fail(403, "実行委員の合言葉でログインしてください");
    const { id } = await ctx.params;
    await deleteShop(id);
    return ok();
  });
}
