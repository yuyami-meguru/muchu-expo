import type { NextRequest } from "next/server";
import { adminShopPatch, fail, failWith, guarded, needAdmin, ok, readBody, sameOrigin, shopPatch } from "@/lib/api";
import { LOGIN_EXPIRED, canEditShop, getSession } from "@/lib/auth";
import { addLiveLog, addLog, deleteShop, getShop, loadAll, saveLive, saveShop, type LiveLogEntry, type LogEntry } from "@/lib/store";
import { KIND_LABEL, placeLabeler, type MenuItem, type Shop } from "@/lib/types";

/*
 * お店を書き換える。
 *  - お店の人：自分のお店の「状態・お知らせ・品物ごとの残り」と「お店の紹介（ひとこと・どんなお店？・思い・当日の流れ・メニュー）」
 *    （店名・部門・場所・非表示・並び順は送っても捨てる）
 *  - 実行委員：すべての欄
 * 営業の状態・お知らせ・品物の残りは、送られた物だけを 1 つずつ書く（saveLive）。同時にほかの人が押しても消えない。
 * メニューを送っても、品物の残りは今のまま（残りは stock の配列でだけ変える）。送らなかった欄は今のまま。
 * ほかの人が直した欄の確かめ（v0.12.0）：本文の base に、送る欄と同じ名前で「画面を開いたときの値」を入れると、
 *   いまの保存の値とちがう欄（ほかの人が直した）があれば、何も書かずに 409 { conflict: ["menu", …] } を返す。
 *   メニューは品物の残りを除いて比べる（売り切れは別に動くので）。送る値がいまの値と同じ欄は比べない。base が無い欄は今までどおり書く。
 *   保存できたら、返した shop を次の base にする（自分の保存で 409 にならないように）。
 * ほかのお店は、ここ（サーバー）で断る。中身の欄が変わったら「変更の記録」に、状態・残り・お知らせは「当日の動き」に残す。
 */

/** 409 の文に出す欄の呼び名（画面の名前） */
const FIELD_NAME: Record<string, string> = {
  name: "お店の名前",
  dept: "部門",
  kind: "「何したい？」の分け方",
  catch: "ひとこと",
  description: "どんなお店？",
  message: "お店の思い",
  placeId: "場所",
  placeNote: "場所の補足",
  hidden: "お客さんの画面（表示・非表示）",
  order: "並び順",
  state: "お店の状態",
  notice: "お店からのお知らせ",
  menu: "メニュー",
  schedule: "当日の流れ",
};

const rec = (x: unknown) => (x && typeof x === "object" ? (x as Record<string, unknown>) : {});
const txt = (v: unknown) => (typeof v === "string" ? v.trim() : v == null ? "" : String(v));
/** 比べるための形（メニューは品物の残りを除く） */
function sig(field: string, v: unknown): string {
  if (field === "menu") return JSON.stringify(Array.isArray(v) ? v.map((x) => [txt(rec(x).id), txt(rec(x).name), txt(rec(x).price), txt(rec(x).note)]) : []);
  if (field === "schedule") return JSON.stringify(Array.isArray(v) ? v.map((x) => [txt(rec(x).time), txt(rec(x).text)]) : []);
  if (field === "hidden") return String(v === true);
  if (field === "order") return String(Number(v) || 0);
  return txt(v);
}

export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/staff/shops/[id]">) {
  return guarded(async () => {
    const { id } = await ctx.params;
    const s = await getSession();
    if (!s) return fail(401, LOGIN_EXPIRED);
    if (!canEditShop(s, id)) return fail(403, "ほかのお店は変えられません。自分のお店の QR で入ってください");
    const admin = s.role === "admin";
    const by = admin ? "admin" : s.shop;
    const b = await readBody(req, admin ? adminShopPatch : shopPatch, { labels: { name: "お店の名前" } });
    if ("error" in b) return b.error;
    const shop = await getShop(id, { fresh: true });
    if (!shop) return fail(404, "お店が見つかりません。画面を読み込み直してください");

    const { stock, menu, state, notice, base, ...rest } = b.data as typeof b.data & Partial<Shop>;

    // 0. ほかの人が直した欄があれば、何も書かない
    if (base) {
      const sent: Record<string, unknown> = { ...rest, ...(menu !== undefined ? { menu } : {}), ...(state !== undefined ? { state } : {}), ...(notice !== undefined ? { notice } : {}) };
      const now = shop as unknown as Record<string, unknown>;
      const conflict = Object.keys(sent).filter((f) => f in FIELD_NAME && f in base && sig(f, base[f]) !== sig(f, now[f]) && sig(f, sent[f]) !== sig(f, now[f]));
      if (conflict.length) {
        return failWith(409, `ほかの人が${conflict.map((f) => `「${FIELD_NAME[f]}」`).join("")}を直しました。読み込み直してから、もう一度直してください`, { conflict });
      }
    }

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
      next = await saveShop(next);
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
      // 場所はピンの名前で残す（英字の id では分からないので）。場所を変えたときだけ読む（使い回しの読みでよい）
      let place = (pid: string) => pid || "未定";
      if (rest.placeId !== undefined && rest.placeId !== shop.placeId) {
        const { places, areas } = await loadAll();
        const where = placeLabeler(areas);
        place = (pid: string) => (pid ? where(places.find((p) => p.id === pid)) || pid : "未定");
      }
      const names: Names = { dept: (d: string) => depts?.find((x) => x.id === d)?.name ?? d, place };
      await addLog(diff(shop, { ...next, notice: notice ?? shop.notice }, by, names));
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

type Names = { dept: (id: string) => string; place: (id: string) => string };

/** 記録に残す欄と、その呼び名（売り切れ・状態は入れない）。英字の値は画面の言葉にして残す */
const LOGGED: [string, (s: Shop, x: Names) => string][] = [
  ["お店の名前", (s) => s.name],
  ["部門", (s, x) => x.dept(s.dept)],
  ["「何したい？」の分け方", (s) => KIND_LABEL[s.kind] ?? s.kind],
  ["ひとこと", (s) => s.catch],
  ["どんなお店？", (s) => s.description],
  ["お店の思い", (s) => s.message],
  ["場所", (s, x) => x.place(s.placeId)],
  ["場所の補足", (s) => s.placeNote],
  ["お客さんの画面", (s) => (s.hidden ? "非表示" : "表示中")],
  ["並び順", (s) => String(s.order)],
  ["お店からのお知らせ", (s) => s.notice],
  ["当日の流れ", (s) => s.schedule.map((x) => `${x.time} ${x.text}`.trim()).join(" ／ ")],
  // メニューは名前・値段・メモだけを比べる（残りの切り替えは「当日の動き」へ）
  ["メニュー", (s) => s.menu.map((m) => [m.name, m.price, m.note].filter(Boolean).join(" ")).join(" ／ ")],
];

const cut = (t: string) => (t.length > 80 ? `${t.slice(0, 79)}…` : t);

function diff(before: Shop, after: Shop, by: string, names: Names): LogEntry[] {
  const at = Date.now();
  const out: LogEntry[] = [];
  for (const [label, pick] of LOGGED) {
    const a = pick(before, names);
    const b = pick(after, names);
    if (a !== b) out.push({ at, by, shop: after.id, shopName: after.name, field: label, before: cut(a), after: cut(b) });
  }
  return out;
}

/** お店を消す（実行委員だけ） */
export async function DELETE(req: NextRequest, ctx: RouteContext<"/api/staff/shops/[id]">) {
  return guarded(async () => {
    if (!sameOrigin(req)) return fail(403, "このサイトの画面から操作してください");
    const no = await needAdmin();
    if (no) return no;
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
