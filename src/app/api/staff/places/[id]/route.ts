import type { NextRequest } from "next/server";
import { fail, guarded, ok, placeBody, readBody, sameOrigin, zId } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { deletePlace, loadAll, savePlace } from "@/lib/store";
import { OUTSIDE, type Place } from "@/lib/types";

/** 地図のピンを作る・直す（実行委員だけ）。area はどの面か（外か、フロアの id）。w・h がどちらも 0 より大きければ部屋の四角 */
export async function PUT(req: NextRequest, ctx: RouteContext<"/api/staff/places/[id]">) {
  return guarded(async () => {
    const s = await getSession();
    if (s?.role !== "admin") return fail(403, "実行委員の合言葉でログインしてください");
    const { id } = await ctx.params;
    if (!zId.safeParse(id).success) return fail(400, "英字の名前は、小文字の a〜z・数字・「-」だけにしてください");
    const b = await readBody(req, placeBody);
    if ("error" in b) return b.error;
    const { area, w, h, ...rest } = b.data;
    if (area !== OUTSIDE && !(await loadAll({ fresh: true })).areas.some((a) => a.id === area)) {
      return fail(400, "そのフロアはありません。画面を読み込み直してください");
    }
    const place: Place = { id, ...rest, ...(area !== OUTSIDE ? { area } : {}), ...(w > 0 && h > 0 ? { w, h } : {}) };
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
