import type { NextRequest } from "next/server";
import { guarded, needAdmin, ok } from "@/lib/api";
import { listLog } from "@/lib/store";

/** 変更の記録（実行委員だけ）。?shop=お店の id で絞れる */
export async function GET(req: NextRequest) {
  return guarded(async () => {
    const no = await needAdmin();
    if (no) return no;
    const shop = req.nextUrl.searchParams.get("shop");
    const log = await listLog();
    return ok({ log: shop ? log.filter((e) => e.shop === shop) : log });
  });
}
