import { randomBytes } from "node:crypto";
import type { NextRequest } from "next/server";
import { guarded, needAdmin, ok, readBody } from "@/lib/api";
import { memoBody, type Memo } from "@/lib/ops";
import { setSetting } from "@/lib/store";

/** 実行委員から全部のお店の人への連絡を出す（空の文なら消す）。お客さんには見えない */
export async function PUT(req: NextRequest) {
  return guarded(async () => {
    const no = await needAdmin();
    if (no) return no;
    const b = await readBody(req, memoBody);
    if ("error" in b) return b.error;
    const memo: Memo | null = b.data.text ? { id: `${Date.now().toString(36)}-${randomBytes(2).toString("hex")}`, text: b.data.text, at: Date.now() } : null;
    await setSetting("memo", memo ? JSON.stringify(memo) : "");
    return ok({ memo });
  });
}
