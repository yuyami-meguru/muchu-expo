import { fail, guarded, ok } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { loadMemoAck, loadMemoAcks, loadStaffOps } from "@/lib/ops-server";
import { getShop, loadAll } from "@/lib/store";
import type { AdminLive, ShopLive, StaffLiveShop } from "@/lib/ops";
import type { Shop } from "@/lib/types";

/*
 * 従業員側の画面が 15 秒ごとに読む「いまの様子」（CDN にはためない）。
 * 当日は 20 台ほどが読み続けるので、読む量を小さくする（お店の人は自分のお店だけ。実行委員は 2 秒の使い回しを使う）。
 *  - 実行委員：全部のお店（非表示のお店も）・お店の人への連絡と読んだ印
 *  - お店の人：自分のお店・お店の人への連絡（読んだかどうか）
 * 別のスマホや実行委員が変えた売り切れも、これで画面に入る。
 */
export async function GET() {
  return guarded(async () => {
    const s = await getSession();
    if (!s) return fail(401, "ログインが切れました。お店の人はお店の QR を、実行委員は合言葉で入り直してください");
    const pick = (x: Shop | null | undefined): StaffLiveShop | null =>
      x ? { state: x.state, notice: x.notice, noticeAt: x.noticeAt, stock: Object.fromEntries(x.menu.map((m) => [m.id, m.stock])), hidden: x.hidden, updatedAt: x.updatedAt } : null;
    if (s.role === "admin") {
      const [data, { memo }, acks] = await Promise.all([loadAll(), loadStaffOps(), loadMemoAcks()]);
      const body: AdminLive = { at: Date.now(), shops: Object.fromEntries(data.shops.map((x) => [x.id, pick(x)!])), memo, acks };
      return ok(body);
    }
    const [shop, { memo }, ack] = await Promise.all([getShop(s.shop, { fresh: true }), loadStaffOps(), loadMemoAck(s.shop)]);
    const body: ShopLive = { at: Date.now(), shop: pick(shop), memo, acked: !!memo && ack === memo.id };
    return ok(body);
  });
}
