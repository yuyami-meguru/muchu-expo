import type { NextRequest } from "next/server";
import { fail, guarded, ok, sameOrigin } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { getShop, rotateShopKey } from "@/lib/store";

/** お店の QR を作り直す（なくした・知らない人に渡ったとき）。前の QR とログイン中の人は使えなくなる。実行委員だけ */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/staff/shops/[id]/key">) {
  return guarded(async () => {
    if (!sameOrigin(req)) return fail(403, "このサイトの画面から操作してください");
    const s = await getSession();
    if (s?.role !== "admin") return fail(403, "実行委員の合言葉でログインしてください");
    const { id } = await ctx.params;
    if (!(await getShop(id, { fresh: true }))) return fail(404, "お店が見つかりません");
    await rotateShopKey(id);
    return ok();
  });
}
