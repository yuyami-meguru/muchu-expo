import type { NextRequest } from "next/server";
import { adminShopPatch, fail, guarded, ok, readBody, sameOrigin, shopPatch } from "@/lib/api";
import { canEditShop, getSession } from "@/lib/auth";
import { addLiveLog, addLog, deleteShop, getShop, loadAll, saveLive, saveShop, type LiveLogEntry, type LogEntry } from "@/lib/store";
import type { MenuItem, Shop } from "@/lib/types";

/*
 * お店を書き換える。
 *  - お店の人：自分のお店の「状態・お知らせ・品物ごとの残り」と「お店の紹介（ひとこと・どんなお店？・思い・当日の流れ・メニュー）」
 *    （店名・部門・場所・非表示・並び順は送っても捨てる）
 *  - 実行委員：すべての欄
 * 営業の状態・お知らせ・品物の残りは、送られた物だけを 1 つずつ書く（saveLive）。同時にほかの人が押しても消えない。
 * メニューを送っても、品物の残りは今のまま（残りは stock の配列でだけ変える）。
 * ほかのお店は、ここ（サーバー）で断る。中身の欄が変わったら「変更の記録」に、状態・残り・お知らせは「当日の動き」に残す。
 */
export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/staff/shops/[id]">) {
  return guarded(async () => {
    const { id } = await ctx.params;
    const s = await getSession();
    if (!s) return fail(401, "ログインが切れました。お店の QR をもう一度読み取ってください");
    if (!canEditShop(s, id)) return fail(403, "ほかのお店は変えられません。自分のお店の QR で入ってください");
    const admin = s.role === "admin";
    const by = admin ? "admin" : s.shop;
    const b = await readBody(req, admin ? adminShopPatch : shopPatch);
    if ("error" in b) return b.error;
    const shop = await getShop(id, { fresh: true });
    if (!shop) return fail(404, "お店が見つかりません。画面を読み込み直してください");

    const { stock, menu, state, notice, ...rest } = b.data as typeof b.data & Partial<Shop>;
    const depts = rest.dept && rest.dept !== shop.dept ? (await loadAll({ fresh: true })).depts : null;
    if (depts && !depts.some((d) => d.id === rest.dept)) return fail(400, "その部門はありません。画面を読み込み直してください");

    // 1. 中身（名前・紹介・メニューなど）。送られた欄があるときだけ
    let next: Shop = shop;
    if (menu || Object.keys(rest).length) {
      next = { ...shop, ...rest };
      if (menu) {
        // 残り（stock）は今の値のまま（新しい品物は「販売中」）
        const cur = new Map(shop.menu.map((m) => [m.id, m.stock]));
        next.menu = menu.map((m): MenuItem => ({ id: m.id, name: m.name, price: m.price, note: m.note, stock: cur.get(m.id) ?? "on" }));
      }
      await saveShop(next);
    }

    // 2. 当日よく変わる物（送られた物だけ）
    const items = new Set(next.menu.map((m) => m.id));
    const stockMap = Object.fromEntries((stock ?? []).filter((x) => items.has(x.id)).map((x) => [x.id, x.stock]));
    const live = {
      ...(state !== undefined ? { state } : {}),
      ...(notice !== undefined ? { notice } : {}),
      ...(Object.keys(stockMap).length ? { stock: stockMap } : {}),
    };
    if (Object.keys(live).length) await saveLive({ [id]: live });

    try {
      const at = Date.now();
      const deptName = (id: string) => depts?.find((d) => d.id === id)?.name ?? id;
      await addLog(diff(shop, { ...next, notice: notice ?? shop.notice }, by, deptName));
      const moves: LiveLogEntry[] = [];
      if (state !== undefined && state !== shop.state) moves.push({ at, by, shop: id, kind: "state", value: state });
      if (notice !== undefined && notice !== shop.notice) moves.push({ at, by, shop: id, kind: "notice", value: notice });
      for (const [item, st] of Object.entries(stockMap)) {
        if (shop.menu.find((m) => m.id === item)?.stock !== st) moves.push({ at, by, shop: id, kind: "stock", item, value: st });
      }
      await addLiveLog(moves);
    } catch (e) {
      // 記録に失敗しても、保存はできているので成功として返す
      console.error("変更の記録に失敗", e);
    }
    return ok({ shop: await getShop(id, { fresh: true }) });
  });
}

/** 記録に残す欄と、その呼び名（売り切れ・状態は入れない） */
const LOGGED: [string, (s: Shop, deptName: (id: string) => string) => string][] = [
  ["店名", (s) => s.name],
  ["部門", (s, deptName) => deptName(s.dept)],
  ["何したい？の分類", (s) => s.kind],
  ["ひとこと", (s) => s.catch],
  ["どんなお店？", (s) => s.description],
  ["お店の思い", (s) => s.message],
  ["地図のピン", (s) => s.placeId],
  ["場所の補足", (s) => s.placeNote],
  ["非表示", (s) => (s.hidden ? "非表示" : "表示中")],
  ["並び順", (s) => String(s.order)],
  ["お店からのお知らせ", (s) => s.notice],
  ["当日の流れ", (s) => s.schedule.map((x) => `${x.time} ${x.text}`.trim()).join(" ／ ")],
  // メニューは名前・値段・メモだけを比べる（残りの切り替えは「当日の動き」へ）
  ["メニュー", (s) => s.menu.map((m) => [m.name, m.price, m.note].filter(Boolean).join(" ")).join(" ／ ")],
];

const cut = (t: string) => (t.length > 80 ? `${t.slice(0, 79)}…` : t);

function diff(before: Shop, after: Shop, by: string, deptName: (id: string) => string): LogEntry[] {
  const at = Date.now();
  const out: LogEntry[] = [];
  for (const [label, pick] of LOGGED) {
    const a = pick(before, deptName);
    const b = pick(after, deptName);
    if (a !== b) out.push({ at, by, shop: after.id, shopName: after.name, field: label, before: cut(a), after: cut(b) });
  }
  return out;
}

/** お店を消す（実行委員だけ） */
export async function DELETE(req: NextRequest, ctx: RouteContext<"/api/staff/shops/[id]">) {
  return guarded(async () => {
    if (!sameOrigin(req)) return fail(403, "このサイトの画面から操作してください");
    const s = await getSession();
    if (s?.role !== "admin") return fail(403, "実行委員の合言葉でログインしてください");
    const { id } = await ctx.params;
    const shop = await getShop(id, { fresh: true });
    await deleteShop(id);
    if (shop) {
      try {
        await addLog([{ at: Date.now(), by: "admin", shop: id, shopName: shop.name, field: "お店を消した", before: shop.name, after: "" }]);
      } catch (e) {
        console.error("変更の記録に失敗", e);
      }
    }
    return ok();
  });
}
