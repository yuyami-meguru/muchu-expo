import type { NextRequest } from "next/server";
import { z } from "zod";
import { fail, guarded, ok, readBody } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { loadAll, saveShop } from "@/lib/store";

/** 公開しているお店をまとめて「営業中」にする（実行委員だけ。当日 10:00 用）。品物の残りとお知らせは触らない */
export async function POST(req: NextRequest) {
  return guarded(async () => {
    const s = await getSession();
    if (s?.role !== "admin") return fail(403, "実行委員の合言葉でログインしてください");
    const b = await readBody(req, z.object({}));
    if ("error" in b) return b.error;
    const { shops } = await loadAll({ fresh: true });
    let count = 0;
    for (const shop of shops) {
      if (shop.hidden || shop.state === "open") continue;
      await saveShop({ ...shop, state: "open" });
      count++;
    }
    return ok({ count });
  });
}
