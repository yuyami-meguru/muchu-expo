// 当日の道具（まとめて戻す・一斉に営業中・控えの保存と復元）を確かめる（手元の next dev に向けて実行）。
//   npm run dev のあとで  npm run check:tools
// はじめに控えを取り、最後にその控えへ戻すので、手元のデータは元のまま残る。お店のかぎは .data/dev.json から読む（手元専用）。
import { readFileSync } from "node:fs";

const BASE = process.env.BASE ?? "http://localhost:3470";
const PASS = process.env.ADMIN_PASSPHRASE ?? "dev-pass";
const keys = JSON.parse(readFileSync(new URL("../.data/dev.json", import.meta.url), "utf8")).key;

let failed = 0;
function check(name, cond, extra = "") {
  console.log(`${cond ? "OK " : "NG "} ${name}${extra ? `  (${extra})` : ""}`);
  if (!cond) failed++;
}

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
    return { status: r.status, json, text, headers: r.headers };
  }
}

/** 項目の並び順を気にしない JSON（比べる用） */
const canon = (v) =>
  Array.isArray(v) ? `[${v.map(canon).join(",")}]` : v && typeof v === "object" ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canon(v[k])}`).join(",")}}` : JSON.stringify(v);

/** 比べるときは保存した時刻（updatedAt）を除く */
const strip = (d) => ({
  depts: [...d.depts].sort((a, b) => a.id.localeCompare(b.id)),
  places: [...d.places].sort((a, b) => a.id.localeCompare(b.id)),
  shops: [...d.shops]
    .map((s) => {
      const c = { ...s };
      delete c.updatedAt;
      return c;
    })
    .sort((a, b) => a.id.localeCompare(b.id)),
});

const admin = new Client();
check("合言葉で入れる", (await admin.req("POST", "/api/staff/login", { pass: PASS })).status === 200);

// はじめの控え
const ex = await admin.req("GET", "/api/staff/export");
const backup = ex.json;
check("実行委員は控えを取れる（JSON）", ex.status === 200 && backup?.app === "muchu-expo" && Array.isArray(backup.shops), `${ex.status}`);
check("控えはファイルとして渡す", /attachment; filename="muchu-backup-\d{8}-\d{4}\.json"/.test(ex.headers.get("content-disposition") ?? ""), ex.headers.get("content-disposition") ?? "");
check("控えにお店のかぎが入っていない", !Object.values(keys).some((k) => ex.text.includes(k)) && !("key" in (backup ?? {})));

// ログインなし・お店の人は使えない
const anon = new Client();
const shopId = backup.shops[0].id;
const shop = new Client();
check("お店の QR で入れる", (await shop.req("POST", "/api/staff/join", { shop: shopId, key: keys[shopId] })).status === 200);
for (const [who, c] of [["ログインなし", anon], ["お店の人", shop]]) {
  check(`${who}はまとめて戻せない`, [401, 403].includes((await c.req("POST", "/api/staff/reset", { confirm: "リセット" })).status));
  check(`${who}は一斉に営業中にできない`, [401, 403].includes((await c.req("POST", "/api/staff/open-all", {})).status));
  check(`${who}は控えを取れない`, [401, 403].includes((await c.req("GET", "/api/staff/export")).status));
  check(`${who}は控えから戻せない`, [401, 403].includes((await c.req("POST", "/api/staff/import", { confirm: "上書き", data: backup })).status));
}
check("ほかのサイトからは断る", (await admin.req("POST", "/api/staff/reset", { confirm: "リセット" }, { origin: "https://evil.example" })).status === 403);

// まとめて戻す
check("合言葉の確認がちがえばまとめて戻せない", (await admin.req("POST", "/api/staff/reset", { confirm: "はい" })).status === 400);
// 売り切れが 1 つはある状態にしてから
const first = backup.shops.find((s) => s.menu.length);
await admin.req("PATCH", `/api/staff/shops/${first.id}`, { stock: [{ id: first.menu[0].id, stock: "out" }], state: "open", notice: "テスト" });
check("まとめて戻せる", (await admin.req("POST", "/api/staff/reset", { confirm: "リセット" })).status === 200);
let now = (await admin.req("GET", "/api/staff/export")).json;
check("全部の品物が販売中", now.shops.every((s) => s.menu.every((m) => m.stock === "on")));
check("全部のお店が準備中・お知らせなし", now.shops.every((s) => s.state === "prep" && s.notice === ""));

// 一斉に営業中
check("一斉に営業中にできる", (await admin.req("POST", "/api/staff/open-all", {})).status === 200);
now = (await admin.req("GET", "/api/staff/export")).json;
check("公開中のお店は全部営業中（非公開は変えない）", now.shops.every((s) => (s.hidden ? s.state === "prep" : s.state === "open")));

// 控えから戻す（形のちがうものは断る）
check("形のちがう控えは断る", (await admin.req("POST", "/api/staff/import", { confirm: "上書き", data: { app: "muchu-expo", depts: [], shops: [{ id: "x" }], places: [] } })).status === 400);
check("確認の言葉がなければ戻せない", (await admin.req("POST", "/api/staff/import", { data: backup })).status === 400);
const im = await admin.req("POST", "/api/staff/import", { confirm: "上書き", data: backup });
check("控えから戻せる", im.status === 200, JSON.stringify(im.json?.saved ?? im.json));
now = (await admin.req("GET", "/api/staff/export")).json;
check("控えを取ったときと同じ中身に戻った", canon(strip(now)) === canon(strip(backup)));
check("戻したあともお店の QR で入れる（かぎはそのまま）", (await new Client().req("POST", "/api/staff/join", { shop: shopId, key: keys[shopId] })).status === 200);

console.log(failed ? `\n${failed} 件 NG` : "\nすべて OK");
process.exit(failed ? 1 : 0);
