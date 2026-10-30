import type { NextRequest } from "next/server";
import { guarded, needAdmin, ok, readBody } from "@/lib/api";
import { loadAll, setSetting } from "@/lib/store";
import { AWARD_KEY, awardBody } from "@/app/(public)/award/award-data";

/**
 * 夢中アワードの設定を保存する（実行委員だけ）。ないお店・非公開のお店の受賞は外す。
 * 同じサイトから・JSON だけ（readBody）。お店の人・ログインなしは 403
 */
export async function PUT(req: NextRequest) {
  return guarded(async () => {
    const no = await needAdmin();
    if (no) return no;
    const b = await readBody(req, awardBody);
    if ("error" in b) return b.error;
    const { shops } = await loadAll({ fresh: true });
    const ids = new Set(shops.filter((x) => !x.hidden).map((x) => x.id));
    const ids2 = new Set<string>();
    const awards = b.data.awards
      .filter((a) => !ids2.has(a.id) && ids2.add(a.id))
      .map((a) => {
        const seen = new Set<string>();
        return { ...a, winners: a.winners.filter((w) => ids.has(w.shop) && !seen.has(w.shop) && seen.add(w.shop)) };
      });
    const saved = { ...b.data, awards };
    await setSetting(AWARD_KEY, JSON.stringify(saved));
    return ok({ award: saved });
  });
}
