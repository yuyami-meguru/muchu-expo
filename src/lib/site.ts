// サイトの正式なアドレス（2026-10-29 に averix.jp の下に決めた）。muchu-expo.vercel.app でも開ける
export const SITE_URL = "https://encare-dream-expo2026.encourage-school.averix.jp";

// パンフの QR が指す GitHub Pages（リポジトリの docs/）。そこから正式なアドレスへ移す
// （刷ったパンフの QR を、サイトのアドレスが変わっても使えるように）。リポジトリの名前を変えないこと
export const PAMPHLET_URL = "https://yuyami-meguru.github.io/muchu-expo";

/**
 * パンフ 3 ページ目（知育館 2 階・3 階の見取り図）に 1 つずつ貼る QR。PAMPHLET_URL/<path>/（docs/<path>/index.html）から、
 * サイトのその階の地図（/map?area=<area>）へ移す。パンフに 4 階は無い（4 階へは地図の画面から移る）。
 * QR の画像は scripts/make-floor-qr.mjs が docs/print/qr-<path>.png・svg に作る（ポスターの画面からも保存できる）
 */
export const PAMPHLET_FLOORS = [
  { path: "2f", area: "f2" },
  { path: "3f", area: "f3" },
] as const;
