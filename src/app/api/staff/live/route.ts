import type { NextRequest } from "next/server";
import { fail, guarded, ok } from "@/lib/api";
import { LOGIN_EXPIRED, getSession } from "@/lib/auth";
import { loadMemoAck, loadMemoAcks, loadStaffOps } from "@/lib/ops-server";
import { getShop, loadAll, STAFF_POLL_READ, staffPollBusy, type ReadOpts } from "@/lib/store";
import type { AdminLive, ShopLive, StaffLiveShop } from "@/lib/ops";
import type { Shop } from "@/lib/types";

/*
 * 従業員側の画面が読み直す「いまの様子」（CDN にはためない）。
 *  - 実行委員：全部のお店（非表示のお店も）・お店の人への連絡と読んだ印・表示の時期・全体の帯・ラジオの放送中
 *  - お店の人：自分のお店・お店の人への連絡（読んだかどうか）・表示の時期の設定（連絡と同じ 1 回の読み込みで読む）
 * 別のスマホや実行委員が変えた売り切れも、これで画面に入る。
 * 読み方（Upstash の回数を増やさないため。当日は 30〜40 台が 15 秒ごとに読む）：
 *  - ?fresh=1（押したあとの読み直し・画面を開いた直後）…… いつも新しく読む
 *  - それ以外（15 秒ごとの読み直し）…… 同じサーバーの中で、当日の値は 5 秒・中身は 10 秒まで使い回す（STAFF_POLL_READ）。
 *    読み直しが少ないとき（開催前など）、お店の人の分は、そのお店の分だけ新しく読む（その方が安い。staffPollBusy）。
 *    多いときは全部の表をまとめて読んで使い回すので、台数が増えても Redis を読む回数は増えない
 *    （ほかの人が押した売り切れは、長くて 5 秒＋読み直しの間隔で入る）
 * 答えの時刻（at）は「中身はこれより新しい」と言える時刻：?fresh=1 は読み始めた時刻、ふだんの読み直しは使い回す長さ（STAFF_POLL_READ.content）だけ前。
 * 画面（use-staff-live.ts）は at の新しい答えを使うので、使い回しの答えが、直前に新しく読んだ答えを上書きしない（「○時の様子」も中身より新しく出ない）
 */
export async function GET(req: NextRequest) {
  return guarded(async () => {
    const s = await getSession();
    if (!s) return fail(401, LOGIN_EXPIRED);
    const fresh = req.nextUrl.searchParams.get("fresh") === "1";
    const at = Date.now() - (fresh ? 0 : STAFF_POLL_READ.content);
    const share = !fresh && staffPollBusy();
    const opts: ReadOpts = fresh ? { fresh: true } : { read: STAFF_POLL_READ };
    const hashAge = share ? STAFF_POLL_READ.live : 0;
    const pick = (x: Shop | null | undefined): StaffLiveShop | null =>
      x ? { state: x.state, notice: x.notice, noticeAt: x.noticeAt, stock: Object.fromEntries(x.menu.map((m) => [m.id, m.stock])), hidden: x.hidden, updatedAt: x.updatedAt } : null;
    if (s.role === "admin") {
      const [data, { memo, phase, alert, radio }, acks] = await Promise.all([loadAll(opts), loadStaffOps(opts), loadMemoAcks({ maxAge: hashAge })]);
      const body: AdminLive = { at, shops: Object.fromEntries(data.shops.map((x) => [x.id, pick(x)!])), memo, acks, phase, alert, radio };
      return ok(body);
    }
    const [shop, { memo, phase }, ack] = await Promise.all([
      getShop(s.shop, share ? opts : { fresh: true }),
      loadStaffOps(opts),
      loadMemoAck(s.shop, { maxAge: hashAge }),
    ]);
    const body: ShopLive = { at, shop: pick(shop), memo, acked: !!memo && ack === memo.id, phase };
    return ok(body);
  });
}
