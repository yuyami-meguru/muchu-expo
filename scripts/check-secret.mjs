// ひみつのホーム（開催日の次の日 11/29 の 0:00 から）と、パンフの QR の転送先を確かめる（手元の next dev に向けて実行）。
//   npm run dev のあとで  npm run check:secret
// 時刻は手元だけのクッキー dev-now（ミリ秒の数）で変える（本番では読まないので、本番には向けない）。
import { readFileSync } from "node:fs";

const BASE = process.env.BASE ?? "http://localhost:3470";

let failed = 0;
function check(name, cond, extra = "") {
  console.log(`${cond ? "OK " : "NG "} ${name}${extra ? `  (${extra})` : ""}`);
  if (!cond) failed++;
}

const at = (s) => Date.parse(s);
const get = async (path, now) => (await fetch(BASE + path, { cache: "no-store", headers: now === undefined ? {} : { cookie: `dev-now=${now}` } })).text();

// 当日のうちは、ふだんのホーム
const day = await get("/", at("2026-11-28T15:00:00+09:00"));
check("11/28 の 15:00 は、ふだんのホーム", !day.includes("ひみつのホーム") && day.includes("夢中万博って"));
const last = await get("/", at("2026-11-28T23:59:59+09:00"));
check("11/28 の 23:59 まで、ふだんのホーム", !last.includes("ひみつのホーム") && last.includes("夢中万博って"));

// 次の日の 0:00 から、ひみつのホーム
const next = await get("/", at("2026-11-29T00:00:00+09:00"));
check("11/29 の 0:00 から、ひみつのホーム", next.includes("ひみつのホーム") && next.includes("ありがとう！") && !next.includes("夢中万博って"));
check("11/29 は「きのうは」", next.includes("きのうは") && next.includes("エンカレ夢中万博に来てくださり"));
check("「終わった次の日から開いた人だけ」と書いてある", next.includes("終わった次の日から開いた人だけが見られる"));
check("白いバンダナと［色をつける］がある", next.includes("同じ白から") && next.includes("色をつける") && next.includes("スタートは、みんな同じ白から"));
check("あの日のきろくと、当日のページへの入口がある", next.includes("あの日のきろく") && next.includes('href="/shops"') && next.includes('href="/map"'));
const data = JSON.parse(readFileSync(new URL("../.data/dev.json", import.meta.url), "utf8"));
// 手元のデータ（.data/dev.json）のお店は「id → 中身（JSON の文字か、そのままの形）」
const shops = Object.values(data.shop ?? {})
  .map((v) => (typeof v === "string" ? JSON.parse(v) : v))
  .filter((s) => !s.hidden);
check("きろくのお店・出し物の数が、表に出しているお店の数", shops.length > 0 && next.includes(`<b>${shops.length}</b>`), `${shops.length} 件`);

// その先の日は「11 月 28 日は」
const later = await get("/", at("2026-12-05T10:00:00+09:00"));
check("11/30 から先は「11 月 28 日は」", later.includes("ひみつのホーム") && later.includes("11 月 28 日は") && !later.includes("きのうは"));

// ほかのページは、次の日もそのまま
check("次の日も、お店・出し物のページが開く", (await get("/shops", at("2026-11-29T09:00:00+09:00"))).includes("お店・出し物"));
check("次の日も、マップが開く", (await get("/map?area=f2", at("2026-11-29T09:00:00+09:00"))).includes("知育館 2階"));

// v0.28.0：サイトのあゆみ（/history）。CHANGELOG.md の版がすべて載っていること・入口があること
const hist = await get("/history");
const changelog = readFileSync(new URL("../CHANGELOG.md", import.meta.url), "utf8");
const versions = [...changelog.matchAll(/^## v(\d+\.\d+\.\d+)/gm)].map((m) => m[1]);
const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
check("サイトのあゆみが開く", hist.includes("あゆみ") && hist.includes("更新の記録") && hist.includes("大事にしたこと"));
const missing = versions.filter((v) => !hist.includes(`v${v}<`));
check("CHANGELOG.md の版が、サイトのあゆみにすべて載っている", versions.length > 0 && missing.length === 0, missing.length ? `ない版：${missing.join("・")}` : `${versions.length} 版`);
check("いまの版（package.json）が、サイトのあゆみに載っている", hist.includes(`v${pkg.version}<`), `v${pkg.version}`);
// （ページの中身の受け渡し（RSC）には、見つからないときの画面の枠が入るので、描いた HTML の class で見る）
check("サイトのあゆみには、万博のまわりの枠（下のメニュー）が無い", !hist.includes('class="shell-tabs"'));
const homeNow = await get("/", at("2026-11-28T15:00:00+09:00"));
check("いちばん下の帯の版の番号から、サイトのあゆみへ行ける", homeNow.includes('href="/history"'));
check("ひみつのホームから、サイトのあゆみへ行ける", next.includes('href="/history"') && next.includes("サイトのあゆみ"));

// パンフの QR の転送（GitHub Pages の docs/）は、メニューを消す形（?solo=1）を付けない
for (const dir of ["2f", "3f", "survey", "award"]) {
  const html = readFileSync(new URL(`../docs/${dir}/index.html`, import.meta.url), "utf8");
  check(`QR の転送 docs/${dir}/ は ?solo=1 を付けない`, !html.includes("solo"));
}

console.log(failed ? `\n${failed} 件 NG` : "\nすべて OK");
process.exit(failed ? 1 : 0);
