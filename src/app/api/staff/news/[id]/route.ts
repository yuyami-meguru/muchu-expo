import type { NextRequest } from "next/server";
import { fail, guarded, ok, sameOrigin } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { deleteNews } from "@/lib/store";

export async function DELETE(req: NextRequest, ctx: RouteContext<"/api/staff/news/[id]">) {
  return guarded(async () => {
    if (!sameOrigin(req)) return fail(403, "このサイトの画面から操作してください");
    const s = await getSession();
    if (s?.role !== "admin") return fail(403, "実行委員の合言葉でログインしてください");
    const { id } = await ctx.params;
    await deleteNews(id);
    return ok();
  });
}
