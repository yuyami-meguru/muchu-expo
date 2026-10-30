import type { NextRequest } from "next/server";
import { z } from "zod";
import { guarded, needAdmin, ok, readBody } from "@/lib/api";
import { parseAlert, type SiteAlert } from "@/lib/ops";
import { loadRadio } from "@/lib/radio-server";
import { getSetting, loadAll, saveLive, setSetting, type LivePatch } from "@/lib/store";

/**
 * 売り切れと状態をまとめて戻す（実行委員だけ）。前日の練習のあとや、当日の朝に使う。
 * 全部のお店：品物はすべて「販売中」、状態は「準備中」、お店からのお知らせは空。
 * also（任意）に入れたものも、いっしょに消す：
 *   "alert" 全体の帯（文は残して、出すのをやめる）／"memo" お店の人への連絡／"radio" ラジオの放送中（番組表と募集はそのまま）
 * 押しまちがいを防ぐため、中身に {confirm:"リセット"} が要る。
 */
export async function POST(req: NextRequest) {
  return guarded(async () => {
    const no = await needAdmin();
    if (no) return no;
    const b = await readBody(req, z.object({ confirm: z.literal("リセット"), also: z.array(z.enum(["alert", "memo", "radio"])).max(3).optional() }));
    if ("error" in b) return b.error;
    const { shops } = await loadAll({ fresh: true });
    const changes: Record<string, LivePatch> = Object.fromEntries(
      shops.map((shop) => [shop.id, { state: "prep" as const, notice: "", stock: Object.fromEntries(shop.menu.map((m) => [m.id, "on" as const])) }]),
    );
    await saveLive(changes);
    const also = [...new Set(b.data.also ?? [])];
    const now = Date.now();
    if (also.includes("alert")) {
      const cur = parseAlert(await getSetting("alert"));
      const off: SiteAlert = { ...cur, on: false, at: now };
      await setSetting("alert", JSON.stringify(off));
    }
    if (also.includes("memo")) await setSetting("memo", "");
    if (also.includes("radio")) await setSetting("radio", JSON.stringify({ ...(await loadRadio()), onAir: false, now: "", updatedAt: now }));
    return ok({ count: shops.length, also });
  });
}
