import type { NextRequest } from "next/server";
import { z } from "zod";
import { fail, guarded, needAdmin, ok, readBody, sameOrigin } from "@/lib/api";
import { layoutPlaces, OUT_ITEM_ID, OUT_MAX, OUT_MAX_ITEMS, OUT_MIN, OUT_PLACE_ID, parseLayout, type OutLayout } from "@/lib/outside-plan";
import { addLog, loadAll, saveOutLayout } from "@/lib/store";

/*
 * 外の会場マップの配置（v0.22.0。実行委員だけ）。PUT で配置をまるごと保存する（「はじめの配置にする」も、はじめの配置を送る）。
 * 配置から消えた場所（out-…）を場所にしていたお店は「未定」に戻し、変更の記録に残して、unlinked（お店の id）を返す
 */
const coordX = z.number().min(OUT_MIN.x).max(OUT_MAX.x);
const coordY = z.number().min(OUT_MIN.y).max(OUT_MAX.y);
const itemSchema = z
  .object({
    id: z.string().regex(OUT_ITEM_ID),
    k: z.enum(["booth", "rest", "bldg", "other", "cafe", "key", "recv", "fuji", "fire"]),
    shape: z.enum(["rect", "round", "wc", "busstop", "text"]).optional(),
    x1: coordX,
    y1: coordY,
    x2: coordX,
    y2: coordY,
    label: z.string().max(40),
    sub: z.string().max(20).optional(),
    size: z.number().min(8).max(40).optional(),
    rx: z.number().min(0).max(60).optional(),
    dash: z.boolean().optional(),
    dx: z.number().min(-200).max(200).optional(),
    dy: z.number().min(-200).max(200).optional(),
    building: z.string().max(20).optional(),
    place: z
      .object({
        id: z.string().regex(OUT_PLACE_ID),
        kind: z.enum(["spot", "building", "info", "toilet", "aid", "rest", "gate", "bus", "parking"]),
        name: z.string().trim().min(1).max(30),
        note: z.string().max(60),
      })
      .optional(),
  })
  .refine((i) => i.x2 - i.x1 >= 6 && i.y2 - i.y1 >= 6, { message: "枠が小さすぎます" });
const body = z.object({ layout: z.object({ items: z.array(itemSchema).max(OUT_MAX_ITEMS) }) });

export async function PUT(req: NextRequest) {
  return guarded(async () => {
    if (!sameOrigin(req)) return fail(403, "このサイトの画面から操作してください");
    const no = await needAdmin();
    if (no) return no;
    const b = await readBody(req, body, { invalid: "配置の中身がおかしいので保存できませんでした。画面を読み込み直してから、もう一度直してください" });
    if ("error" in b) return b.error;
    const ids = b.data.layout.items.map((i) => i.id);
    if (new Set(ids).size !== ids.length) return fail(400, "同じ名前（id）の枠が 2 つあります。画面を読み込み直してください");
    // 同じ場所の枠は、名前・種類・ひとことを 1 つ目の枠にそろえる（どの枠を押しても同じ案内が出るように）
    const first = new Map<string, NonNullable<OutLayout["items"][number]["place"]>>();
    const items = b.data.layout.items.map((i) => {
      if (!i.place) return i;
      const p = first.get(i.place.id);
      if (!p) {
        first.set(i.place.id, i.place);
        return i;
      }
      return { ...i, place: p };
    });
    const layout = parseLayout({ items });
    if (!layout) return fail(400, "配置を読めませんでした");

    const before = await loadAll({ fresh: true });
    const oldPlaces = layoutPlaces(before.outLayout);
    const keep = new Set(layoutPlaces(layout).map((p) => p.id));
    const dropped = oldPlaces.filter((p) => !keep.has(p.id));
    const unlinked = await saveOutLayout(layout, dropped.map((p) => p.id));
    if (unlinked.length) {
      const at = Date.now();
      const nameOf = (sid: string) => before.shops.find((s) => s.id === sid)?.name ?? sid;
      const placeOf = (sid: string) => dropped.find((p) => p.id === before.shops.find((s) => s.id === sid)?.placeId)?.name ?? "";
      await addLog(
        unlinked.map((sid) => ({ at, by: "admin", shop: sid, shopName: nameOf(sid), field: "場所", before: placeOf(sid), after: "未定（会場マップの配置から消した）" })),
      ).catch((e) => console.error("変更の記録に失敗", e));
    }
    return ok({ layout, unlinked });
  });
}
