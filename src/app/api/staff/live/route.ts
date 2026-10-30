import { fail, guarded, ok } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { loadCalls, loadMemo, loadMemoAcks } from "@/lib/ops-server";
import { loadAll } from "@/lib/store";
import type { AdminLive, ShopLive, StaffLiveShop } from "@/lib/ops";

/*
 * 従業員側の画面が 10 秒ごとに読む「いまの様子」（キャッシュしない・いつも最新）。
 *  - 実行委員：全部のお店（非表示のお店も）・呼び出し・お店の人への連絡と読んだ印
 *  - お店の人：自分のお店・自分の呼び出し・お店の人への連絡（読んだかどうか）
 * 別のスマホや実行委員が変えた売り切れも、これで画面に入る。
 */
export async function GET() {
  return guarded(async () => {
    const s = await getSession();
    if (!s) return fail(401, "ログインが切れました。お店の人はお店の QR を、実行委員は合言葉で入り直してください");
    const [data, memo] = await Promise.all([loadAll({ fresh: true }), loadMemo()]);
    const pick = (id: string): StaffLiveShop | null => {
      const x = data.shops.find((shop) => shop.id === id);
      return x
        ? { state: x.state, notice: x.notice, stock: Object.fromEntries(x.menu.map((m) => [m.id, m.stock])), hidden: x.hidden, updatedAt: x.updatedAt }
        : null;
    };
    if (s.role === "admin") {
      const [calls, acks] = await Promise.all([loadCalls(), loadMemoAcks()]);
      const body: AdminLive = { at: Date.now(), shops: Object.fromEntries(data.shops.map((x) => [x.id, pick(x.id)!])), calls, memo, acks };
      return ok(body);
    }
    const [calls, acks] = await Promise.all([loadCalls(s.shop), loadMemoAcks()]);
    const body: ShopLive = { at: Date.now(), shop: pick(s.shop), calls, memo, acked: !!memo && acks[s.shop] === memo.id };
    return ok(body);
  });
}
