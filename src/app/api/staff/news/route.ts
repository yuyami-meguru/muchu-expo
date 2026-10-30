import { randomBytes } from "node:crypto";
import type { NextRequest } from "next/server";
import { fail, guarded, newsBody, ok, readBody } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { parseAlert } from "@/lib/ops";
import { getSetting, loadAll, saveNews } from "@/lib/store";

/** 全体のお知らせの画面が 15 秒ごとに読む：出ているお知らせと、全体の帯（実行委員だけ。ほかの実行委員が出した分も入る） */
export async function GET() {
  return guarded(async () => {
    const s = await getSession();
    if (s?.role !== "admin") return fail(403, "実行委員の合言葉でログインしてください");
    const [{ news }, alert] = await Promise.all([loadAll({ fresh: true }), getSetting("alert")]);
    return ok({ news, alert: parseAlert(alert) });
  });
}

/** 実行委員からのお知らせを出す（トップの上に出る） */
export async function POST(req: NextRequest) {
  return guarded(async () => {
    const s = await getSession();
    if (s?.role !== "admin") return fail(403, "実行委員の合言葉でログインしてください");
    const b = await readBody(req, newsBody);
    if ("error" in b) return b.error;
    const news = { id: randomBytes(6).toString("hex"), at: Date.now(), ...b.data };
    await saveNews(news);
    return ok({ news });
  });
}
