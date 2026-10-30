import type { NextRequest } from "next/server";
import { z } from "zod";
import { fail, guarded, ok, readBody } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { loadRadioMsgs, MSG_MAX } from "@/lib/radio-server";
import { setSetting } from "@/lib/store";

/** メッセージに「読んだ」印を付ける・外す（実行委員だけ） */
export async function PUT(req: NextRequest) {
  return guarded(async () => {
    const s = await getSession();
    if (s?.role !== "admin") return fail(403, "実行委員の合言葉でログインしてください");
    const b = await readBody(req, z.object({ ids: z.array(z.string().regex(/^[a-f0-9]{6,20}$/)).min(1).max(200), read: z.boolean() }));
    if ("error" in b) return b.error;
    const { messages, readIds } = await loadRadioMsgs();
    const alive = new Set(messages.map((m) => m.id));
    const set = new Set(readIds.filter((id) => alive.has(id)));
    for (const id of b.data.ids) {
      if (b.data.read) set.add(id);
      else set.delete(id);
    }
    const next = [...set].slice(-MSG_MAX);
    await setSetting("radio-read", JSON.stringify(next));
    return ok({ readIds: next });
  });
}
