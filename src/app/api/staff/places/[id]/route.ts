import type { NextRequest } from "next/server";
import { fail, guarded, needAdmin, ok, placeBody, readBody, sameOrigin, zId } from "@/lib/api";
import { addLog, deletePlace, loadAll, savePlace } from "@/lib/store";
import { OUTSIDE, placeLabeler, type Place } from "@/lib/types";

/** 地図のピンを作る・直す（実行委員だけ）。消すとき（DELETE）は、そのピンを場所にしていたお店を「未定」に戻し、unlinked（お店の id）を返す。area はどの面か（外か、フロアの id）。w・h がどちらも 0 より大きければ部屋の四角 */
export async function PUT(req: NextRequest, ctx: RouteContext<"/api/staff/places/[id]">) {
  return guarded(async () => {
    const no = await needAdmin();
    if (no) return no;
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
    const no = await needAdmin();
    if (no) return no;
    const { id } = await ctx.params;
    // 記録に出す名前だけに使う（使い回しの読みでよい）
    const before = await loadAll();
    const pin = before.places.find((p) => p.id === id);
    // そのピンを場所にしていたお店は「未定」に戻る（store.ts の deletePlace）。変更の記録にも残す
    const unlinked = await deletePlace(id);
    if (unlinked.length) {
      const where = placeLabeler(before.areas)(pin) || id;
      const at = Date.now();
      await addLog(
        unlinked.map((sid) => ({ at, by: "admin", shop: sid, shopName: before.shops.find((x) => x.id === sid)?.name ?? sid, field: "場所", before: where, after: "未定（ピンを消した）" })),
      ).catch((e) => console.error("変更の記録に失敗", e));
    }
    return ok({ unlinked });
  });
}
