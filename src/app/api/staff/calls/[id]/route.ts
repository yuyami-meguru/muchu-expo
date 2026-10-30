import type { NextRequest } from "next/server";
import { fail, guarded, ok, readBody } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { callPatch, parseCalls } from "@/lib/ops";
import { readHash, writeHash } from "@/lib/store";

/** 呼び出しの様子を変える：実行委員は「向かっています」「済み」、お店の人は自分の呼び出しを「済み」（解決した・取り消し）にできる */
export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/staff/calls/[id]">) {
  return guarded(async () => {
    const s = await getSession();
    if (!s) return fail(401, "ログインが切れました。入り直してください");
    const b = await readBody(req, callPatch);
    if ("error" in b) return b.error;
    const { id } = await ctx.params;
    const call = parseCalls(await readHash("call")).find((c) => c.id === id);
    if (!call) return fail(404, "その呼び出しは見つかりません。画面を読み込み直してください");
    if (s.role === "shop" && (call.shop !== s.shop || b.data.status !== "done")) return fail(403, "この呼び出しは変えられません");
    const next = { ...call, status: b.data.status, updatedAt: Date.now() };
    await writeHash("call", { [id]: JSON.stringify(next) });
    return ok({ call: next });
  });
}
