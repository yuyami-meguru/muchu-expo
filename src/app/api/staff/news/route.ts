import { randomBytes } from "node:crypto";
import type { NextRequest } from "next/server";
import { fail, guarded, newsBody, ok, readBody } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { saveNews } from "@/lib/store";

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
