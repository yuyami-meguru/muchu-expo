import type { NextRequest } from "next/server";
import { z } from "zod";
import { fail, guarded, ok, readBody, sameOrigin } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { deleteNews, loadAll, saveNews } from "@/lib/store";

/** お知らせを直す：文と「いちばん上に固定する」（送った物だけ変える。出した時刻はそのまま） */
const newsPatch = z
  .object({ text: z.string().trim().min(1).max(140).optional(), pinned: z.boolean().optional() })
  .refine((v) => v.text !== undefined || v.pinned !== undefined, "直す中身がありません");

export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/staff/news/[id]">) {
  return guarded(async () => {
    const s = await getSession();
    if (s?.role !== "admin") return fail(403, "実行委員の合言葉でログインしてください");
    const b = await readBody(req, newsPatch);
    if ("error" in b) return b.error;
    const { id } = await ctx.params;
    const cur = (await loadAll({ fresh: true })).news.find((n) => n.id === id);
    if (!cur) return fail(404, "そのお知らせは見つかりません（ほかの人が消したかもしれません）。画面を読み込み直してください");
    const news = { ...cur, ...b.data };
    await saveNews(news);
    return ok({ news });
  });
}

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
