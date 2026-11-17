/*
 * 校内ラジオのお店（お店・出し物の一覧にもある。id は radio）。
 * このお店が非表示（実行委員の「お店の情報」で［お客さんの画面から隠す］）なら、ラジオのページ・ホームの入口・いちばん下の案内・
 * 「放送中」の札も出さず、メッセージも受け付けない（2026-11-17 から。ユーザーの希望で隠した）。出すときは［お客さんの画面に出す］。
 * live.ts（どの画面でも読む）からも使うので、zod を使う radio.ts とは分けて小さく置く
 */
export const RADIO_SHOP = "radio";

/** お客さんに校内ラジオを出しているか（ラジオのお店があって、非表示でない） */
export const radioShown = (shops: readonly { id: string; hidden: boolean }[]) => shops.some((s) => s.id === RADIO_SHOP && !s.hidden);
