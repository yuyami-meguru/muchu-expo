import { randomBytes } from "node:crypto";
import type { NextRequest } from "next/server";
import { guarded, needAdmin, newsBody, ok, readBody } from "@/lib/api";
import { parseAlert } from "@/lib/ops";
import { getSetting, loadNews, saveNews } from "@/lib/store";

/** 押し直し（返事が遅れて 2 回押した・読み込み直してもう一度押した）とみなす長さ */
const SAME_MS = 60_000;

/**
 * 全体のお知らせの画面が 15 秒ごとに読む：出ているお知らせと、全体の帯（実行委員だけ。ほかの実行委員が出した分も入る）。
 * お知らせと帯の 2 つだけを読む（お店などの表は読まない。Upstash の回数を増やさないため）
 */
export async function GET() {
  return guarded(async () => {
    const no = await needAdmin();
    if (no) return no;
    const [news, alert] = await Promise.all([loadNews({ fresh: true }), getSetting("alert", { fresh: true })]);
    return ok({ news, alert: parseAlert(alert) });
  });
}

/**
 * 実行委員からのお知らせを出す（トップの上に出る）。
 * 同じ文のお知らせを 1 分のうちにもう一度出したら、新しく足さずに前のものを返す（押し直しで同じお知らせが 2 つ並ばないように）。
 * 「いちばん上に固定する」だけちがうときは、前のお知らせの固定の印を、送られた方に直して返す（出した時刻はそのまま）
 */
export async function POST(req: NextRequest) {
  return guarded(async () => {
    const no = await needAdmin();
    if (no) return no;
    const b = await readBody(req, newsBody);
    if ("error" in b) return b.error;
    const now = Date.now();
    const same = (await loadNews({ fresh: true })).find((n) => n.text === b.data.text && now - n.at < SAME_MS);
    if (same) {
      if (same.pinned === b.data.pinned) return ok({ news: same, again: true });
      const fixed = { ...same, pinned: b.data.pinned };
      await saveNews(fixed);
      return ok({ news: fixed, again: true });
    }
    const news = { id: randomBytes(6).toString("hex"), at: now, ...b.data };
    await saveNews(news);
    return ok({ news });
  });
}
