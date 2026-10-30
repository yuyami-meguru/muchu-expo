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
check("見取り図に人の名前（配置図の物品のメモ）が入っていない", !/〇〇|〇〇|〇〇|〇〇|〇〇|〇〇|〇〇|〇〇/.test(allMaps));

// フロアの窓口の守り
check("ログインなしではフロアを作れない", (await anon.req("PUT", "/api/staff/areas/floor-x", { building: "テスト館", floor: "1階", order: 9 })).status === 403);
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

console.log(failed ? `\n${failed} 件 NG` : "\nすべて OK");
process.exit(failed ? 1 : 0);
