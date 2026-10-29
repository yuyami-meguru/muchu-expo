import type { NextRequest } from "next/server";
import { fail, guarded, ok } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { listLog } from "@/lib/store";

/** 変更の記録（実行委員だけ）。?shop=お店の id で絞れる */
export async function GET(req: NextRequest) {
  return guarded(async () => {
    const s = await getSession();
    if (s?.role !== "admin") return fail(403, "実行委員の合言葉でログインしてください");
    const shop = req.nextUrl.searchParams.get("shop");
    const log = await listLog();
    return ok({ log: shop ? log.filter((e) => e.shop === shop) : log });
  });
}
