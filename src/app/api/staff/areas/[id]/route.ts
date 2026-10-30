import type { NextRequest } from "next/server";
import { areaBody, fail, guarded, ok, readBody, sameOrigin, zId } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { deleteArea, loadAll, saveArea } from "@/lib/store";
import { OUTSIDE, type Area } from "@/lib/types";

/** フロア（建物の中の面）を作る・直す（実行委員だけ）。見取り図（plan）は、はじめに入れた物をそのまま使う（画面からは変えない） */
export async function PUT(req: NextRequest, ctx: RouteContext<"/api/staff/areas/[id]">) {
  return guarded(async () => {
    const s = await getSession();
    if (s?.role !== "admin") return fail(403, "実行委員の合言葉でログインしてください");
    const { id } = await ctx.params;
    if (!zId.safeParse(id).success || id === OUTSIDE) return fail(400, "英字の名前は、小文字の a〜z・数字・「-」だけにしてください（outside は使えません）");
    const b = await readBody(req, areaBody);
    if ("error" in b) return b.error;
    const cur = (await loadAll({ fresh: true })).areas.find((a) => a.id === id);
    const area: Area = { id, ...b.data, ...(cur?.plan ? { plan: cur.plan } : {}) };
    await saveArea(area);
    return ok({ area });
  });
}

/** フロアを消す（実行委員だけ）。ピンが残っていれば断る（先にピンを消すか、ほかの面へ移す） */
export async function DELETE(req: NextRequest, ctx: RouteContext<"/api/staff/areas/[id]">) {
  return guarded(async () => {
    if (!sameOrigin(req)) return fail(403, "このサイトの画面から操作してください");
    const s = await getSession();
    if (s?.role !== "admin") return fail(403, "実行委員の合言葉でログインしてください");
    const { id } = await ctx.params;
    const n = (await loadAll({ fresh: true })).places.filter((p) => p.area === id).length;
    if (n) return fail(409, `このフロアにはピンが ${n} 個あります。先にピンを消すか、ほかのフロアへ移してください`);
    await deleteArea(id);
    return ok();
  });
}
