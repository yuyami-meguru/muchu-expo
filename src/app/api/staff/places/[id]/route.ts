import type { NextRequest } from "next/server";
import { fail, guarded, ok, placeBody, readBody, sameOrigin, zId } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { deletePlace, savePlace } from "@/lib/store";

/** 地図のピンを作る・直す（実行委員だけ） */
export async function PUT(req: NextRequest, ctx: RouteContext<"/api/staff/places/[id]">) {
  return guarded(async () => {
    const s = await getSession();
    if (s?.role !== "admin") return fail(403, "実行委員の合言葉でログインしてください");
    const { id } = await ctx.params;
    if (!zId.safeParse(id).success) return fail(400, "英字の名前は、小文字の a〜z・数字・「-」だけにしてください");
    const b = await readBody(req, placeBody);
    if ("error" in b) return b.error;
    const place = { id, ...b.data };
    await savePlace(place);
    return ok({ place });
  });
}

export async function DELETE(req: NextRequest, ctx: RouteContext<"/api/staff/places/[id]">) {
  return guarded(async () => {
    if (!sameOrigin(req)) return fail(403, "このサイトの画面から操作してください");
    const s = await getSession();
    if (s?.role !== "admin") return fail(403, "実行委員の合言葉でログインしてください");
    const { id } = await ctx.params;
    await deletePlace(id);
    return ok();
  });
}
