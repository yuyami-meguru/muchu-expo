// 従業員側の守りを確かめる（手元の next dev に向けて実行）。
//   npm run dev のあとで  npm run check:auth
// お店のかぎは .data/dev.json から読む（手元専用）。本番には向けない。
import { readFileSync } from "node:fs";

const BASE = process.env.BASE ?? "http://localhost:3470";
const PASS = process.env.ADMIN_PASSPHRASE ?? "dev-pass";
const data = JSON.parse(readFileSync(new URL("../.data/dev.json", import.meta.url), "utf8"));
const A = "chaya";
const B = "yakisoba";

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
      body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
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

const shop = async (id) => (await fetch(`${BASE}/api/status`, { cache: "no-store" }).then((r) => r.json())).shops[id];

const anon = new Client();
check("ログインなしでは書き換えられない", (await anon.req("PATCH", `/api/staff/shops/${A}`, { state: "open" })).status === 401);

const wrong = new Client();
check("合言葉がちがえば入れない", (await wrong.req("POST", "/api/staff/login", { pass: "nope" })).status === 401);

const admin = new Client();
check("合言葉で入れる", (await admin.req("POST", "/api/staff/login", { pass: PASS })).status === 200);

const bad = new Client();
check("かぎがちがえばお店に入れない", (await bad.req("POST", "/api/staff/join", { shop: A, key: "x".repeat(24) })).status === 401);
check("別のお店のかぎでは入れない", (await bad.req("POST", "/api/staff/join", { shop: A, key: data.key[B] })).status === 401);

const a = new Client();
check("お店 A の QR で入れる", (await a.req("POST", "/api/staff/join", { shop: A, key: data.key[A] })).status === 200);
const before = (await shop(A)).state;
const itemA = Object.keys((await shop(A)).stock)[0];
check("A の売り切れを変えられる", (await a.req("PATCH", `/api/staff/shops/${A}`, { stock: [{ id: itemA, stock: "few" }] })).status === 200);
check("A の状態を変えられる", (await a.req("PATCH", `/api/staff/shops/${A}`, { state: before })).status === 200);
check("B（ほかのお店）は変えられない", (await a.req("PATCH", `/api/staff/shops/${B}`, { state: "closed" })).status === 403);
const r = await a.req("PATCH", `/api/staff/shops/${A}`, { name: "のっとり" });
check("お店の人は店名を変えられない（送っても捨てる）", r.status === 200 && r.json?.shop?.name !== "のっとり", r.json?.shop?.name);
check("お店の人はお知らせを出せない", (await a.req("POST", "/api/staff/news", { text: "x" })).status === 403);
check("お店の人は地図を変えられない", (await a.req("PUT", "/api/staff/places/x1", { name: "x", x: 1, y: 1, note: "" })).status === 403);
check("お店の人は QR を作り直せない", (await a.req("POST", `/api/staff/shops/${A}/key`)).status === 403);
check("お店の人はお店を足せない", (await a.req("POST", "/api/staff/shops", { id: "zz", name: "x", dept: "taiken" })).status === 403);
check("ほかのサイトからは断る", (await a.req("PATCH", `/api/staff/shops/${A}`, { state: "open" }, { origin: "https://evil.example" })).status === 403);
check("フォームの送りつけは断る", (await a.req("PATCH", `/api/staff/shops/${A}`, "state=open", { "content-type": "application/x-www-form-urlencoded" })).status === 415);
check("A の売り切れを元に戻す", (await a.req("PATCH", `/api/staff/shops/${A}`, { stock: [{ id: itemA, stock: "on" }] })).status === 200);

check("実行委員は QR を作り直せる", (await admin.req("POST", `/api/staff/shops/${A}/key`)).status === 200);
check("作り直したら前の QR の人は入れない", (await a.req("PATCH", `/api/staff/shops/${A}`, { state: "open" })).status === 401);
check("作り直したら前の QR では入り直せない", (await a.req("POST", "/api/staff/join", { shop: A, key: data.key[A] })).status === 401);
check("ログアウトできる", (await admin.req("POST", "/api/staff/logout")).status === 200);

console.log(failed ? `\n${failed} 件 NG` : "\nすべて OK");
process.exit(failed ? 1 : 0);
