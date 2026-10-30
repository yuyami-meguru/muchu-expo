import type { NextRequest } from "next/server";
import { guarded, needAdmin, ok, readBody } from "@/lib/api";
import { phaseBody, phaseValue, readPhaseSetting } from "@/lib/ops";
import { setSetting } from "@/lib/store";

/**
 * 表示の時期（日時で自動・開催前・当日・終了後）を変える（実行委員だけ。前日の練習用）。
 * 手で選んだ時期は、切り替えた時刻といっしょに保存し、その日の 24:00 に「日時で自動」に戻る（ops.ts の readPhaseSetting）。
 * until：自動に戻る時刻（自動なら 0）
 */
export async function PUT(req: NextRequest) {
  return guarded(async () => {
    const no = await needAdmin();
    if (no) return no;
    const b = await readBody(req, phaseBody);
    if ("error" in b) return b.error;
    const value = phaseValue(b.data.mode);
    await setSetting("phase", value);
    return ok({ mode: b.data.mode, until: readPhaseSetting(value).until });
  });
}
