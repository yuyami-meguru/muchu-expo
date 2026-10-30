// 地図の「外」とフロア（建物の中）を確かめる（手元の next dev に向けて実行）。
//   npm run dev のあとで  npm run check:map
// 試しに作ったフロア・ピンは最後に消す。本番には向けない。
import { readFileSync } from "node:fs";

const BASE = process.env.BASE ?? "http://localhost:3470";
const PASS = process.env.ADMIN_PASSPHRASE ?? "dev-pass";
const data = JSON.parse(readFileSync(new URL("../.data/dev.json", import.meta.url), "utf8"));

let failed = 0;
function check(name, cond, extra = "") {
  console.log(`${cond ? "OK " : "NG "} ${name}${extra ? `  (${extra})` : ""}`);
  if (!cond) failed++;
}

class Client {
  cookie = "";
  async req(method, path, body) {
    const r = await fetch(BASE + path, {
      method,
      headers: { ...(body !== undefined ? { "content-type": "application/json" } : {}), ...(this.cookie ? { cookie: this.cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: "manual",
    });
    const set = r.headers.get("set-cookie");
    if (set) this.cookie = set.split(";")[0];
    let json = null;
    try {
      json = await r.json();
    } catch {}
    return { status: r.status, json };
  }
}
const page = async (path) => (await fetch(BASE + path, { cache: "no-store" })).text();

const admin = new Client();
await admin.req("POST", "/api/staff/login", { pass: PASS });
const shop = new Client();
await shop.req("POST", "/api/staff/join", { shop: "yakisoba", key: data.key.yakisoba });
const anon = new Client();

// はじめに入れたフロア（2〜4 階）と部屋
const ex = (await admin.req("GET", "/api/staff/export")).json;
check("はじめのフロア（2〜4 階）がある", ["f2", "f3", "f4"].every((id) => ex.areas.some((a) => a.id === id && a.plan)));
check("2 階の部屋が四角のピンとしてある", ex.places.some((p) => p.id === "f2-201" && p.area === "f2" && p.w > 0 && p.h > 0));
check("各階にトイレのピンがある", ["f2", "f3", "f4"].every((id) => ex.places.some((p) => p.area === id && p.kind === "toilet")));

// お客さんの地図
const m2 = await page("/map?area=f2");
check("お客さんの地図で 2 階を開ける", m2.includes("知育館 2階") && m2.includes("201 小講義室"));
check("場所を指して開ける（?place=）", (await page("/map?place=f3-301")).includes("301 教室"));
const allMaps = (await page("/map?area=f2")) + (await page("/map?area=f3")) + (await page("/map?area=f4"));
// 人の名前（見取り図のもとのデータの物品メモにあった）がフロアのページに出ていないこと。
// 名前そのものはリポジトリに入れず、手元だけのファイル .data/private-names.json（.gitignore 済み）から読む
let privateNames = null;
try {
  privateNames = JSON.parse(readFileSync(new URL("../.data/private-names.json", import.meta.url), "utf8")).names ?? [];
} catch {}
if (privateNames) check("フロアのページに人の名前が出ていない", !privateNames.some((n) => allMaps.includes(n)));
else console.log("--  人の名前の確認は、手元の .data/private-names.json が無いので飛ばした");
// 見取り図のデータは建物の形だけ（物品・メモの欄を取りこんでいない）
const planSrc = readFileSync(new URL("../src/lib/floor-plans.ts", import.meta.url), "utf8");
check("見取り図のデータに物品・メモの欄が無い", !/\b(note|memo|items?|owner)\s*:/.test(planSrc));

// フロアの窓口の守り
check("ログインなしではフロアを作れない（ログインの案内）", (await anon.req("PUT", "/api/staff/areas/floor-x", { building: "テスト館", floor: "1階", order: 9 })).status === 401);
check("お店の人はフロアを作れない", (await shop.req("PUT", "/api/staff/areas/floor-x", { building: "テスト館", floor: "1階", order: 9 })).status === 403);
check("outside という名前のフロアは作れない", (await admin.req("PUT", "/api/staff/areas/outside", { building: "テスト館", floor: "1階", order: 9 })).status === 400);
check("建物の名前がないフロアは作れない", (await admin.req("PUT", "/api/staff/areas/floor-x", { building: "", floor: "1階", order: 9 })).status === 400);

// フロアを作る → ピンを置く → 消す
const made = await admin.req("PUT", "/api/staff/areas/floor-check", { building: "テスト館", floor: "1階", order: 99 });
check("実行委員はフロアを作れる", made.status === 200 && made.json?.area?.building === "テスト館");
check("2 階の見取り図は、名前を直しても残る", (await admin.req("PUT", "/api/staff/areas/f2", { building: "知育館", floor: "2階", order: 2 })).json?.area?.plan === "chiikukan-2f");
check("ないフロアにはピンを置けない", (await admin.req("PUT", "/api/staff/places/check-room", { area: "floor-nai", name: "x", x: 10, y: 10, note: "" })).status === 400);
const pl = await admin.req("PUT", "/api/staff/places/check-room", { area: "floor-check", w: 20, h: 30, name: "101 テスト室", x: 30, y: 40, note: "" });
check("フロアに部屋の四角を置ける", pl.status === 200 && pl.json?.place?.area === "floor-check" && pl.json?.place?.w === 20);
const pin = await admin.req("PUT", "/api/staff/places/check-pin", { name: "外のピン", x: 10, y: 10, note: "" });
check("外のピンには面も四角も付かない", pin.status === 200 && pin.json?.place?.area === undefined && pin.json?.place?.w === undefined);
check("ピンのあるフロアは消せない", (await admin.req("DELETE", "/api/staff/areas/floor-check")).status === 409);
await admin.req("DELETE", "/api/staff/places/check-room");
await admin.req("DELETE", "/api/staff/places/check-pin");
check("ピンを消したフロアは消せる", (await admin.req("DELETE", "/api/staff/areas/floor-check")).status === 200);
check("消したフロアは控えに残らない", !(await admin.req("GET", "/api/staff/export")).json.areas.some((a) => a.id === "floor-check"));

// お店の場所（地図のピンの画面の「お店の場所を決める」。選ぶとすぐ PATCH { placeId }）。最後に元に戻す
const placed = (await admin.req("PATCH", "/api/staff/shops/yakisoba", {})).json.shop.placeId;
const toRoom = await admin.req("PATCH", "/api/staff/shops/yakisoba", { placeId: "f3-301" });
check("実行委員はお店の場所をフロアの部屋にできる", toRoom.status === 200 && toRoom.json?.shop?.placeId === "f3-301");
// お客さんのページは読んだ中身を使い回すが、同じサーバーで書いたら使い回しを捨てるので、すぐ新しい中身が出る
check("お店のページに「知育館 3階・301 教室」と出る", (await page("/shops/yakisoba")).includes("知育館 3階・301 教室"));
if (placed !== "f3-301") {
  const placeLog = (await admin.req("GET", "/api/staff/log?shop=yakisoba")).json?.log?.[0];
  check("変更の記録の場所は、英字ではなくピンの名前で残る", placeLog?.field === "場所" && placeLog?.after === "知育館 3階・301 教室", JSON.stringify(placeLog));
}
const toTbd = await admin.req("PATCH", "/api/staff/shops/yakisoba", { placeId: "" });
check("お店の場所を未定に戻せる", toTbd.status === 200 && toTbd.json?.shop?.placeId === "");
await admin.req("PATCH", "/api/staff/shops/yakisoba", { placeId: placed });
check("お店の場所を元に戻した", (await admin.req("PATCH", "/api/staff/shops/yakisoba", {})).json.shop.placeId === placed);

// ピンを消したら、そのピンを場所にしていたお店は「未定」に戻る（同じ名前のピンをあとで足しても、勝手につながらない）
const tmpPin = await admin.req("PUT", "/api/staff/places/check-unlink", { name: "確認用のピン", x: 20, y: 20, note: "" });
const linked = await admin.req("PATCH", "/api/staff/shops/yakisoba", { placeId: "check-unlink" });
check("確認用のピンをお店の場所にできる", tmpPin.status === 200 && linked.json?.shop?.placeId === "check-unlink");
const del = await admin.req("DELETE", "/api/staff/places/check-unlink");
check("ピンを消すと、つながっていたお店を返す", del.status === 200 && del.json?.unlinked?.includes("yakisoba"), JSON.stringify(del.json));
check("ピンを消したお店は場所が未定になる", (await admin.req("PATCH", "/api/staff/shops/yakisoba", {})).json.shop.placeId === "");
await admin.req("PUT", "/api/staff/places/check-unlink", { name: "確認用のピン", x: 20, y: 20, note: "" });
check("同じ名前のピンを足し直しても、お店はつながらない", (await admin.req("PATCH", "/api/staff/shops/yakisoba", {})).json.shop.placeId === "");
await admin.req("DELETE", "/api/staff/places/check-unlink");
await admin.req("PATCH", "/api/staff/shops/yakisoba", { placeId: placed });
check("お店の場所をもう一度元に戻した", (await admin.req("PATCH", "/api/staff/shops/yakisoba", {})).json.shop.placeId === placed);

// フォントを先に読む印（<link rel="preload" as="font">）がたくさんあると、遅い回線で最初の表示が何十秒も遅れる（R8）。
// 字の形は表示のあとに読めばよいので、HTML と Link ヘッダーの as="font" は 0 か、ごく少ないこと
for (const path of ["/", "/shops", "/map?area=f3", "/staff/login"]) {
  const r = await fetch(BASE + path, { cache: "no-store" });
  const html = await r.text();
  const n = (html.match(/as="font"/g) ?? []).length + ((r.headers.get("link") ?? "").match(/as=font/g) ?? []).length;
  check(`${path} でフォントを先に読む印が 4 つ以下`, n <= 4, `${n} 個`);
}

console.log(failed ? `\n${failed} 件 NG` : "\nすべて OK");
process.exit(failed ? 1 : 0);
