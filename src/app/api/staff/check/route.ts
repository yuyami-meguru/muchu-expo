import type { NextRequest } from "next/server";
import { fail, guarded, ok, readBody } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { CHECK_ITEMS, checkBody } from "@/lib/ops";
import { removeHash, writeHash } from "@/lib/store";

/** 当日のチェックリストに印を付ける・外す（実行委員だけ。実行委員みんなで同じ印を見る） */
export async function PUT(req: NextRequest) {
  return guarded(async () => {
    const s = await getSession();
    if (s?.role !== "admin") return fail(403, "実行委員の合言葉でログインしてください");
    const b = await readBody(req, checkBody);
    if ("error" in b) return b.error;
    if (!CHECK_ITEMS.some((c) => c.id === b.data.id)) return fail(400, "その項目はありません。画面を読み込み直してください");
    if (b.data.done) await writeHash("check", { [b.data.id]: String(Date.now()) });
    else await removeHash("check", [b.data.id]);
    return ok();
  });
}
