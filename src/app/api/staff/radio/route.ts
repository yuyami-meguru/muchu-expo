import type { NextRequest } from "next/server";
import { z } from "zod";
import { fail, guarded, ok, readBody, sameOrigin } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { radioStateBody } from "@/lib/radio";
import { loadRadio, loadRadioMsgs } from "@/lib/radio-server";
import { clearList, setSetting } from "@/lib/store";

/* 校内ラジオの窓口（実行委員だけ） */

async function adminOr403() {
  const s = await getSession();
  return s?.role === "admin" ? null : fail(403, "実行委員の合言葉でログインしてください");
}

/** 状態と、届いたメッセージ */
export async function GET() {
  return guarded(async () => {
    const no = await adminOr403();
    if (no) return no;
    const [state, msgs] = await Promise.all([loadRadio(), loadRadioMsgs()]);
    return ok({ state, ...msgs });
  });
}

/** 状態を変える（送った欄だけ） */
export async function PUT(req: NextRequest) {
  return guarded(async () => {
    const no = await adminOr403();
    if (no) return no;
    const b = await readBody(req, radioStateBody);
    if ("error" in b) return b.error;
    const state = { ...(await loadRadio()), ...b.data, updatedAt: Date.now() };
    await setSetting("radio", JSON.stringify(state));
    return ok({ state });
  });
}

/** メッセージを全部消す。{confirm:"消す"} が要る */
export async function DELETE(req: NextRequest) {
  return guarded(async () => {
    if (!sameOrigin(req)) return fail(403, "このサイトの画面から操作してください");
    const no = await adminOr403();
    if (no) return no;
    const b = await readBody(req, z.object({ confirm: z.literal("消す") }));
    if ("error" in b) return fail(400, "確認の言葉がちがいます");
    await clearList("radio-msg");
    await setSetting("radio-read", "[]");
    return ok();
  });
}
