import { randomBytes } from "node:crypto";
import type { NextRequest } from "next/server";
import { fail, guarded, ok, readBody } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { callBody, type Call } from "@/lib/ops";
import { allow, getShop, writeHash } from "@/lib/store";

/** お店の人が実行委員を呼ぶ（お店ごとに 10 分 10 回まで） */
export async function POST(req: NextRequest) {
  return guarded(async () => {
    const s = await getSession();
    if (s?.role !== "shop") return fail(403, "お店の QR で入ったスマホから呼んでください");
    const b = await readBody(req, callBody);
    if ("error" in b) return b.error;
    if (!(await allow(`call:${s.shop}`, 10, 600))) return fail(429, "続けて呼ばれています。少し待つか、近くの実行委員に声をかけてください");
    if (!(await getShop(s.shop, { fresh: true }))) return fail(404, "お店が見つかりません");
    const now = Date.now();
    const call: Call = { id: `${now.toString(36)}-${randomBytes(3).toString("hex")}`, shop: s.shop, reason: b.data.reason, text: b.data.text, at: now, status: "new", updatedAt: now };
    await writeHash("call", { [call.id]: JSON.stringify(call) });
    return ok({ call });
  });
}
