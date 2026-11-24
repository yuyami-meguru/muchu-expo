// パンフに貼る QR を docs/print/qr-<名前>.png・svg に作る。
//   3 ページ目（知育館 2 階・3 階の見取り図）：qr-2f・qr-3f → サイトのその階の地図
//   4 ページ目（下の灰色の枠 2 つ）：qr-survey（左・アンケート）・qr-award（右・夢中アワード）→ サイトの /survey・/award
// 読み取ると GitHub Pages の転送（docs/<名前>/index.html）を通って、サイトのそのページが開く。
// 階の行き先・作りは src/lib/site.ts の PAMPHLET_URL・PAMPHLET_FLOORS と、posters/paper.ts の pamphletQr に合わせる（ポスターの画面の QR と同じもの）
// 4 つとも同じ作り（黒・余白 4・誤り訂正 Q・PNG は 984px）
// node scripts/make-floor-qr.mjs
import { writeFile } from "node:fs/promises";
import QRCode from "qrcode";

const PAMPHLET_URL = "https://yuyami-meguru.github.io/muchu-expo";
const NAMES = ["2f", "3f", "survey", "award"];
const opts = { margin: 4, errorCorrectionLevel: "Q", color: { dark: "#000000", light: "#ffffff" } };

for (const f of NAMES) {
  const url = `${PAMPHLET_URL}/${f}/`;
  const out = (ext) => new URL(`../docs/print/qr-${f}.${ext}`, import.meta.url);
  await QRCode.toFile(out("png").pathname, url, { ...opts, width: 984 });
  await writeFile(out("svg"), await QRCode.toString(url, { ...opts, type: "svg" }));
  console.log(`docs/print/qr-${f}.png・svg → ${url}`);
}
