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
// v0.23.0：パンフの QR から開いたとき（?solo=1）は、メニューを出さない目印がページに入る（ふだんは入らない）
check("QR から開いた 2 階の地図に、メニューを出さない目印がある", (await page("/map?area=f2&solo=1")).includes("data-solo-page"));
check("ふだんの地図には目印が無い", !m2.includes("data-solo-page"));
check("QR から開いたアンケートにも目印がある", (await page("/survey?solo=1")).includes("data-solo-page"));
check("ふだんのアンケートには目印が無い", !(await page("/survey")).includes("data-solo-page"));
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

// v0.17.0：外の場所は会場マップの枠（大食堂・受付など。保存しない決まった場所）
const out = await page("/map");
check("外の地図に会場マップの場所（大食堂・受付・トイレ・バス停）がある", ["out-shokudo", "out-recv", "out-wc", "out-bus"].every((id) => out.includes(`data-pin="${id}"`)));
check("大食堂に「体験・休憩」と出る", out.includes("体験・休憩"));
check("知育館の前の「体験」の箱は無い（体験は大食堂の中）", !/class="op-label[^"]*"[^>]*>体験</.test(out));
check("場所を指して開ける（?place=out-shokudo）", (await page("/map?place=out-shokudo")).includes("体験・休憩ができます"));
const now = JSON.parse(readFileSync(new URL("../.data/dev.json", import.meta.url), "utf8"));
const placeOf = (id) => (now.shop[id] ? JSON.parse(now.shop[id]).placeId : "");
check("体験のお店（射的・押し花）は大食堂", placeOf("shateki") === "out-shokudo" && placeOf("oshibana") === "out-shokudo", `${placeOf("shateki")} ${placeOf("oshibana")}`);
check("前の仮の外のピン（tent-food・tent-chiiku）は無い", !now.place["tent-food"] && !now.place["tent-chiiku"]);
check("会場マップの場所は実行委員でも動かせない", (await admin.req("PUT", "/api/staff/places/out-recv", { name: "受付", x: 10, y: 10, note: "" })).status === 400);
check("会場マップの場所は消せない", (await admin.req("DELETE", "/api/staff/places/out-shokudo")).status === 400);
check("「out-」で始まるピンは作れない", (await admin.req("PUT", "/api/staff/places/out-test", { name: "x", x: 10, y: 10, note: "" })).status === 400);
const ex2 = (await admin.req("GET", "/api/staff/export")).json;
check("控えに会場マップの場所は入らない", !ex2.places.some((p) => p.id.startsWith("out-")));
check("お店の場所の選び方に大食堂がある", (await admin.req("GET", "/staff/shops/shateki")).status === 200 && (await (await fetch(BASE + "/staff/shops/shateki", { headers: { cookie: admin.cookie } })).text()).includes("外・大食堂"));
const moved = await admin.req("PATCH", "/api/staff/shops/yakisoba", { placeId: "out-cafe" });
check("お店の場所を会場マップの場所（カフェ）にできる", moved.json?.shop?.placeId === "out-cafe");
check("その場所に戻せる", (await admin.req("PATCH", "/api/staff/shops/yakisoba", { placeId: placed })).json?.shop?.placeId === placed);

// v0.21.0：クラフトセンターの下のテント（地域部門）と、11/20 の打ち合わせの 1 度だけの直し
// v0.23.5（2026-11-26 の青ペン）：テントはエンカレマルシェの右へ（字は横 2 行「宮島／宮大工」、場所の補足は「エンカレマルシェの右」）
check("外の地図に、エンカレマルシェの右のテント（宮島宮大工）がある", out.includes('data-pin="out-tent-craft"') && out.includes("宮島宮大工のテント") && out.includes(">宮島\n宮大工<"));
check("前の字のテント（宮大工だけ・縦 5 字）は残っていない", !out.includes(">宮\n大\n工<") && !out.includes(">宮大工のテント") && !out.includes(">宮\n島\n宮\n大\n工<"));
check("テントの場所の補足に「クラフトセンターの下」は残っていない", !out.includes("クラフトセンターの下") && out.includes("エンカレマルシェの右"));
// v0.23.1：パンフの試し刷りの赤ペンにそろえた（大食堂の体験の中身・小食堂の茶屋・音楽室の発表・3 階の文書庫を消す）
check("大食堂に体験の中身（押し花しおり・射的）", out.includes("体験・休憩\n押し花しおり・射的"));
check("小食堂の中に茶屋の箱がある", (out.match(/>茶屋</g) ?? []).length >= 2);
check("クラフトセンター・音楽室に「発表」", out.includes("音楽室\n発表"));
const f3 = await page("/map?area=f3");
check("3 階の地図に「文書庫」が出ない", !f3.includes("文書庫"));
check("タイムテーブルの宮大工は「宮島宮大工」（v0.23.3 からはトークイベント）", (await page("/schedule")).includes("トークイベント 宮島宮大工"));
// v0.23.2：ステージ発表は 2 階の「ロビー」（f2-lobby）。手元のデータを読み直して確かめる（ページを開いたあとに直しが入るので）
const after = JSON.parse(readFileSync(new URL("../.data/dev.json", import.meta.url), "utf8"));
check("ステージ発表の場所が 2 階のロビー", JSON.parse(after.shop.stage ?? "{}").placeId === "f2-lobby");
// v0.23.3：2026-11-25 の付箋・赤ペン（射的・押し花しおりの時間、ステージ発表の題）
const sch = await page("/schedule");
check("射的は 10:00〜11:30・押し花しおりは 12:30〜14:00", sch.includes("10:00〜11:30") && sch.includes("12:30〜14:00") && !sch.includes("10:00〜12:00"));
check("ステージ発表の題が赤ペンどおり", sch.includes("お笑いライブ「ネオ職員室」") && sch.includes("トークイベント 宮島宮大工「宮大工の魅力とは？」") && !sch.includes("トークショー"));
// v0.23.4：2 階の 201 に「教科展示」の札（パンフ 3 ページ目の赤ペンと同じ。お店・出し物ではない、表示だけの札＝floor-plans.ts の ROOM_USE）
const room201 = m2.match(/data-pin="f2-201"[\s\S]*?<\/button>/)?.[0] ?? "";
check("2 階の地図の 201 に「教科展示」の札が出る", room201.includes('class="mx-room-use"') && room201.includes(">教科展示<"));
check("201 は「お店・出し物は未定」でなく「教科展示」と読める", room201.includes("201 小講義室（教科展示）"));
const empty2 = m2.match(/<details class="mp-empty"[\s\S]*?<\/details>/)?.[0] ?? "";
check("201 は地図の下の一覧に「教科展示」つきで出る（たたまない）", /mp-place-name">201 小講義室.*?mp-place-use">教科展示</.test(m2) && !empty2.includes("201 小講義室"));
check("教科展示はお店・出し物の一覧に入らない（表示だけの札）", !(await page("/shops")).includes("教科展示"));
const posters = await (await fetch(BASE + "/staff/posters", { headers: { cookie: admin.cookie } })).text();
check("フロアの案内の紙（2 階）の 201 にも「教科展示」", posters.includes('class="pfl-room-use">教科展示<'));
check("保存した配置にも、前の名前のテント（テント・宮島大工）は残っていない", !out.includes("テント（クラフトセンターの下）") && !out.includes(">テ\nン\nト<") && !out.includes("宮島大工"));
check("1 度だけの直しの目印（fix:minutes-1120）が立っている", !!now.flags?.["fix:minutes-1120"]);
for (const id of ["classroom", "radio"]) {
  if (!now.place[id]) continue;
  const p = JSON.parse(now.place[id]);
  if (p.area) continue;
  const used = Object.values(now.shop).some((x) => {
    const s = JSON.parse(x);
    return !s.hidden && s.placeId === id;
  });
  check(`会場マップに置き場所の無い前のピン「${p.name}」は、お店が${used ? "あれば一覧に出る" : "無ければ一覧に出ない"}`, out.includes(`>${p.name}<`) === used);
}

// v0.22.0：会場マップの配置をドラッグで直す（PUT /api/staff/outmap。実行委員だけ）
const lay0 = (await admin.req("GET", "/api/staff/export")).json?.outLayout;
check("控えに外の会場マップの配置が入る（テントもある）", Array.isArray(lay0?.items) && lay0.items.some((i) => i.id === "tent-craft"));
check("配置の保存は、ログインしていないと断る", [401, 403].includes((await anon.req("PUT", "/api/staff/outmap", { layout: lay0 })).status));
check("配置の保存は、お店の人には断る", [401, 403].includes((await shop.req("PUT", "/api/staff/outmap", { layout: lay0 })).status));
// v0.23.5：テントはエンカレマルシェの右（同じ列）で、入口の前ではない。焼きそば・エンカレマルシェは左へ寄せた（保存した配置でも＝tentMoveFix）
{
  const L = (id) => lay0?.items?.find((i) => i.id === id);
  const [yaki, mar, tent, iri] = ["yakisoba", "marche", "tent-craft", "iriguchi"].map(L);
  check("テントはエンカレマルシェの右（同じ列）", !!(tent && mar) && tent.x1 > mar.x2 && tent.y1 === mar.y1, JSON.stringify({ tent, mar }));
  check("テントは入口の前ではない（入口より左）", !!(tent && iri) && tent.x2 < iri.x1);
  check("焼きそばとエンカレマルシェは重ならず、焼きそばが左", !!(yaki && mar) && yaki.x2 < mar.x1);
  check("テントの場所の補足は「エンカレマルシェの右」", tent?.place?.note === "エンカレマルシェの右");
  check("1 度だけの直しの目印（fix:tent-row-1126b）は、保存した配置があるときだけ立つ", !now.omap?.layout || !!JSON.parse(readFileSync(new URL("../.data/dev.json", import.meta.url), "utf8")).flags?.["fix:tent-row-1126b"]);
  // v0.23.6：ユーザーの会場の写真（「こんな」）のとおり、テントの列は生活棟の左はしから並び、いちばん右のテントと入口の間はあく
  const seikatsu = L("seikatsu");
  check("テントの列（焼きそば）は生活棟の左はしから", !!(yaki && seikatsu) && yaki.x1 - seikatsu.x1 <= 20, JSON.stringify({ yaki: yaki?.x1, seikatsu: seikatsu?.x1 }));
  check("宮島宮大工のテントと入口の間があく（50 以上）", !!(tent && iri) && iri.x1 - tent.x2 >= 50, JSON.stringify({ tent: tent?.x2, iri: iri?.x1 }));
}
if (lay0?.items) {
  const t0 = lay0.items.find((i) => i.id === "tent-craft");
  const movedLay = { items: lay0.items.map((i) => (i.id === "tent-craft" ? { ...i, x1: i.x1 - 40, x2: i.x2 - 40 } : i)) };
  const put = await admin.req("PUT", "/api/staff/outmap", { layout: movedLay });
  check("実行委員は配置を保存できる", put.status === 200, String(put.status));
  const tx = movedLay.items.find((i) => i.id === "tent-craft").x1;
  check("お客さんの地図が、保存した配置で描かれる", (await page("/map")).includes(`x="${tx}" y="${t0.y1}"`));
  const dup = { items: [...lay0.items, { ...lay0.items[0] }] };
  check("同じ id の枠が 2 つある配置は断る", (await admin.req("PUT", "/api/staff/outmap", { layout: dup })).status === 400);
  check("小さすぎる枠は断る", (await admin.req("PUT", "/api/staff/outmap", { layout: { items: [{ ...lay0.items[1], x2: lay0.items[1].x1 + 2 }] } })).status === 400);
  check("配置をもとに戻せる", (await admin.req("PUT", "/api/staff/outmap", { layout: lay0 })).status === 200);
  check("戻したあと、テントはもとの位置", (await page("/map")).includes(`x="${t0.x1}" y="${t0.y1}"`));
}

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
