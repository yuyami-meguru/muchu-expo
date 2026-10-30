import type { NextRequest } from "next/server";
import { fail, guarded, needAdmin, ok, readBody } from "@/lib/api";
import { alertBody, type SiteAlert } from "@/lib/ops";
import { setSetting } from "@/lib/store";

/** 全体の帯（雨・急ぎ）を出す・消す（実行委員だけ）。お客さん側の全部のページのいちばん上に、20 秒ほどで出る */
export async function PUT(req: NextRequest) {
  return guarded(async () => {
    const no = await needAdmin();
    if (no) return no;
    const b = await readBody(req, alertBody);
    if ("error" in b) return b.error;
    if (b.data.on && !b.data.text) return fail(400, "帯に出す文を入れてください");
    const alert: SiteAlert = { ...b.data, at: Date.now() };
    await setSetting("alert", JSON.stringify(alert));
    return ok({ alert });
  });
}
