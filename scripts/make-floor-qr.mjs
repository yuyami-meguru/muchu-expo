// パンフ 3 ページ目（知育館 2 階・3 階の見取り図）に貼る QR を docs/print/qr-2f.png・svg、qr-3f.png・svg に作る。
// 読み取ると GitHub Pages の転送（docs/2f・docs/3f）を通って、サイトのその階の地図が開く。
// 行き先・作りは src/lib/site.ts の PAMPHLET_URL・PAMPHLET_FLOORS と、posters/paper.ts の pamphletQr に合わせる（ポスターの画面の QR と同じもの）
// node scripts/make-floor-qr.mjs
import { writeFile } from "node:fs/promises";
import QRCode from "qrcode";

const PAMPHLET_URL = "https://yuyami-meguru.github.io/muchu-expo";
const FLOORS = ["2f", "3f"];
const opts = { margin: 4, errorCorrectionLevel: "Q", color: { dark: "#000000", light: "#ffffff" } };

for (const f of FLOORS) {
  const url = `${PAMPHLET_URL}/${f}/`;
  const out = (ext) => new URL(`../docs/print/qr-${f}.${ext}`, import.meta.url);
  await QRCode.toFile(out("png").pathname, url, { ...opts, width: 984 });
  await writeFile(out("svg"), await QRCode.toString(url, { ...opts, type: "svg" }));
  console.log(`docs/print/qr-${f}.png・svg → ${url}`);
}
