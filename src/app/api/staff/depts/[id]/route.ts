import type { NextRequest } from "next/server";
import { deptBody, fail, guarded, needAdmin, ok, readBody, sameOrigin, zId } from "@/lib/api";
import { deleteDept, loadAll, saveDept } from "@/lib/store";

/** 部門を作る・直す（実行委員だけ）。id は作ったあと変えない（お店がこの id で部門を指している） */
export async function PUT(req: NextRequest, ctx: RouteContext<"/api/staff/depts/[id]">) {
  return guarded(async () => {
    const no = await needAdmin();
    if (no) return no;
    const { id } = await ctx.params;
    if (!zId.safeParse(id).success) return fail(400, "部門を保存できませんでした。画面を読み込み直して、もう一度ためしてください");
    const b = await readBody(req, deptBody);
    if ("error" in b) return b.error;
    const dept = { id, ...b.data };
    await saveDept(dept);
    return ok({ dept });
  });
}

/** 部門を消す（実行委員だけ）。お店が残っている部門は消せない（先に別の部門へ移す） */
export async function DELETE(req: NextRequest, ctx: RouteContext<"/api/staff/depts/[id]">) {
  return guarded(async () => {
    if (!sameOrigin(req)) return fail(403, "このサイトの画面から操作してください");
    const no = await needAdmin();
    if (no) return no;
    const { id } = await ctx.params;
    const left = (await loadAll({ fresh: true })).shops.filter((x) => x.dept === id);
    if (left.length) return fail(409, `この部門にはお店が ${left.length} つあります（${left.map((x) => x.name).join("・")}）。先に別の部門へ移してください`);
    await deleteDept(id);
    return ok();
  });
}
