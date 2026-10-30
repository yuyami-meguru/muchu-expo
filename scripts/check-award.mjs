// 夢中アワードの守りと発表のオン・オフを確かめる（手元の next dev に向けて実行）。 npm run check:award
// テストの前の設定（.data/dev.json の settings.award）を覚えておき、最後に戻す
import { readFileSync } from "node:fs";

const BASE = process.env.BASE ?? "http://localhost:3470";
const PASS = process.env.ADMIN_PASSPHRASE ?? "dev-pass";
const data = JSON.parse(readFileSync(new URL("../.data/dev.json", import.meta.url), "utf8"));
const SHOP = Object.keys(data.key)[0];
const SHOP_NAME = JSON.parse(data.shop[SHOP]).name;
const ORIGINAL = data.settings?.award ? JSON.parse(data.settings.award) : { title: "夢中アワード", published: false, teaser: "", awards: [] };

let failed = 0;
const check = (name, cond, extra = "") => {
  console.log(`${cond ? "OK " : "NG "} ${name}${extra ? `  (${extra})` : ""}`);
  if (!cond) failed++;
};

class Client {
  cookie = "";
  async req(method, path, body, headers = {}) {
    const r = await fetch(BASE + path, {
      method,
      headers: { ...(body !== undefined ? { "content-type": "application/json" } : {}), ...(this.cookie ? { cookie: this.cookie } : {}), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: "manual",
    });
    const set = r.headers.get("set-cookie");
    if (set) this.cookie = set.split(";")[0];
    const text = await r.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {}
    return { status: r.status, json, text };
  }
}

const anon = new Client();
const admin = new Client();
await admin.req("POST", "/api/staff/login", { pass: PASS });
const shop = new Client();
await shop.req("POST", "/api/staff/join", { shop: SHOP, key: data.key[SHOP] });

const mark = `講評テスト${Date.now()}`;
const award = (published) => ({
  title: "夢中アワード",
  published,
  teaser: "14:00 ごろ発表します",
  awards: [{ id: "award-1", name: "テスト大賞", note: "ためし", winners: [{ shop: SHOP, comment: mark }, { shop: "nai-shop", comment: "x" }] }],
});

check("ログインなしでは変えられない", (await anon.req("PUT", "/api/staff/award", award(false))).status === 403);
check("お店の人は変えられない", (await shop.req("PUT", "/api/staff/award", award(false))).status === 403);
check("ほかのサイトからは断る", (await admin.req("PUT", "/api/staff/award", award(false), { origin: "https://evil.example" })).status === 403);
check("名前が空なら断る（形のちがうデータ）", (await admin.req("PUT", "/api/staff/award", { ...award(false), title: "" })).status === 400);
check("賞の形がちがえば断る", (await admin.req("PUT", "/api/staff/award", { ...award(false), awards: [{ id: "x", name: "a" }] })).status === 400);

const r = await admin.req("PUT", "/api/staff/award", award(false));
check("実行委員は保存できる（発表オフ）", r.status === 200);
const winners = r.json?.award?.awards?.[0]?.winners?.map((w) => w.shop) ?? [];
check("ないお店は受賞から外す", winners.length === 1 && winners[0] === SHOP, winners.join(","));

let page = await anon.req("GET", "/award");
check("発表オフのあいだは講評が出ない", page.status === 200 && !page.text.includes(mark));
check("発表オフのあいだは賞の名前も出ない", !page.text.includes("テスト大賞"));
check("発表オフのあいだは発表前の文が出る", page.text.includes("14:00 ごろ発表します"));

check("発表をオンにできる", (await admin.req("PUT", "/api/staff/award", award(true))).status === 200);
page = await anon.req("GET", "/award");
check("発表オンで受賞のお店と講評が出る", page.text.includes(mark) && page.text.includes(SHOP_NAME) && page.text.includes("テスト大賞"));
check("発表オンでもないお店は出ない", !page.text.includes("nai-shop"));
check("集計の画面は実行委員だけ", (await shop.req("GET", "/staff/award")).status === 307);

check("元の設定に戻す", (await admin.req("PUT", "/api/staff/award", ORIGINAL)).status === 200);

console.log(failed ? `\n${failed} 件 NG` : "\nすべて OK");
process.exit(failed ? 1 : 0);
