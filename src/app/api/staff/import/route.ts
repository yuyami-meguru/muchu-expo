import type { NextRequest } from "next/server";
import { z } from "zod";
import { fail, guarded, ok, readBody, zId } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { deleteDept, deletePlace, deleteShop, loadAll, saveDept, savePlace, saveShop } from "@/lib/store";

/*
 * 控えから戻す（実行委員だけ）。控えの部門・お店・場所で上書きする。
 *  - 控えにあるものは保存し直す（お店の編集用のかぎはそのまま → 配った QR は使える）
 *  - 控えに無いもの（控えのあとで足したもの）は消す。お知らせは触らない
 * 押しまちがいを防ぐため、中身に confirm:"上書き" が要る。
 */
const s = (max: number) => z.string().max(max);
const stock = z.enum(["on", "few", "out"]);
const deptSchema = z.object({
  id: zId,
  name: s(20).min(1),
  short: s(8).min(1),
  tagline: s(40),
  color: z.enum(["blue", "orange", "red", "purple", "green", "teal", "pink", "brown"]),
  order: z.number().int().min(0).max(9999),
});
const shopSchema = z.object({
  id: zId,
  dept: z.string().max(40),
  kind: z.enum(["eat", "play", "see"]),
  name: s(40).min(1),
  catch: s(60),
  description: s(600),
  message: s(600),
  placeId: z.union([zId, z.literal("")]),
  placeNote: s(60),
  menu: z.array(z.object({ id: zId, name: s(40).min(1), price: s(30), note: s(60), stock })).max(40),
  schedule: z.array(z.object({ time: s(20), text: s(80).min(1) })).max(30),
  state: z.enum(["prep", "open", "break", "closed"]),
  notice: s(120),
  hidden: z.boolean(),
  order: z.number().int().min(0).max(9999),
  updatedAt: z.number(),
});
const placeSchema = z.object({ id: zId, name: s(30).min(1), x: z.number().min(0).max(100), y: z.number().min(0).max(100), note: s(60) });
const backupSchema = z.object({
  confirm: z.literal("上書き"),
  data: z.object({
    app: z.literal("muchu-expo"),
    depts: z.array(deptSchema).max(50),
    shops: z.array(shopSchema).max(200),
    places: z.array(placeSchema).max(100),
  }),
});

export async function POST(req: NextRequest) {
  return guarded(async () => {
    const sess = await getSession();
    if (sess?.role !== "admin") return fail(403, "実行委員の合言葉でログインしてください");
    const b = await readBody(req, backupSchema);
    if ("error" in b) return b.error;
    const { depts, shops, places } = b.data.data;
    const now = await loadAll({ fresh: true });

    for (const d of depts) await saveDept(d);
    for (const p of places) await savePlace(p);
    for (const shop of shops) await saveShop(shop);

    const keep = { dept: new Set(depts.map((d) => d.id)), shop: new Set(shops.map((x) => x.id)), place: new Set(places.map((p) => p.id)) };
    const removed = { depts: 0, shops: 0, places: 0 };
    for (const x of now.shops) {
      if (keep.shop.has(x.id)) continue;
      await deleteShop(x.id);
      removed.shops++;
    }
    for (const x of now.depts) {
      if (keep.dept.has(x.id)) continue;
      await deleteDept(x.id);
      removed.depts++;
    }
    for (const x of now.places) {
      if (keep.place.has(x.id)) continue;
      await deletePlace(x.id);
      removed.places++;
    }

    return ok({ saved: { depts: depts.length, shops: shops.length, places: places.length }, removed });
  });
}
