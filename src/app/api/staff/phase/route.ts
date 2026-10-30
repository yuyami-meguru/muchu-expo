import type { NextRequest } from "next/server";
import { fail, guarded, ok, readBody } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { phaseBody } from "@/lib/ops";
import { setSetting } from "@/lib/store";

/** 表示の時期（日時で自動・開催前・当日・終了後）を変える（実行委員だけ。前日の練習用） */
export async function PUT(req: NextRequest) {
  return guarded(async () => {
    const s = await getSession();
    if (s?.role !== "admin") return fail(403, "実行委員の合言葉でログインしてください");
    const b = await readBody(req, phaseBody);
    if ("error" in b) return b.error;
    await setSetting("phase", b.data.mode);
    return ok({ mode: b.data.mode });
  });
}
