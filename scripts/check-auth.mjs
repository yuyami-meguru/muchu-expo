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
check("お店の人は部門を変えられない", (await a.req("PUT", "/api/staff/depts/zz", { name: "x", short: "x", tagline: "", color: "blue", order: 1 })).status === 403);
check("お店の人はお店を足せない", (await a.req("POST", "/api/staff/shops", { id: "zz", name: "x", dept: "taiken" })).status === 403);
check("ほかのサイトからは断る", (await a.req("PATCH", `/api/staff/shops/${A}`, { state: "open" }, { origin: "https://evil.example" })).status === 403);
check("フォームの送りつけは断る", (await a.req("PATCH", `/api/staff/shops/${A}`, "state=open", { "content-type": "application/x-www-form-urlencoded" })).status === 415);
// お店の紹介：お店の人が自分の中身を書ける。ほかのお店・店名などは変えられない。残りは勝手に変わらない。記録が残る
const orig = (await a.req("PATCH", `/api/staff/shops/${A}`, {})).json?.shop;
const mark = `確認用の説明 ${Date.now()}`;
const rd = await a.req("PATCH", `/api/staff/shops/${A}`, { description: mark });
check("お店の人は自分の「どんなお店？」を変えられる", rd.status === 200 && rd.json?.shop?.description === mark);
check("ほかのお店の「どんなお店？」は変えられない", (await a.req("PATCH", `/api/staff/shops/${B}`, { description: "x" })).status === 403);
const rn = await a.req("PATCH", `/api/staff/shops/${A}`, { name: "のっとり", dept: "unei", hidden: true, order: 1 });
check(
  "お店の人が店名・部門・非公開・並び順を送っても変わらない",
  rn.status === 200 && rn.json?.shop?.name === orig.name && rn.json?.shop?.dept === orig.dept && rn.json?.shop?.hidden === orig.hidden && rn.json?.shop?.order === orig.order,
);
const rp = await a.req("PATCH", `/api/staff/shops/${A}`, { placeId: "f3-301", placeNote: "のっとり" });
check(
  "お店の人が場所・場所の補足を送っても変わらない（場所は実行委員が決める）",
  rp.status === 200 && rp.json?.shop?.placeId === orig.placeId && rp.json?.shop?.placeNote === orig.placeNote,
);
await a.req("PATCH", `/api/staff/shops/${A}`, { stock: [{ id: itemA, stock: "few" }] });
const menuNoStock = orig.menu.map(({ id, name, price, note }) => ({ id, name, price, note }));
const rm = await a.req("PATCH", `/api/staff/shops/${A}`, { menu: [...menuNoStock, { id: "check-item", name: "確認用の品物", price: "100円", note: "" }] });
const mA = rm.json?.shop?.menu ?? [];
check("お店の人は品物を足せる", rm.status === 200 && mA.some((m) => m.id === "check-item" && m.stock === "on"));
check("メニューを送っても、ほかの品物の残りは変わらない", mA.find((m) => m.id === itemA)?.stock === "few");
const rs = await a.req("PATCH", `/api/staff/shops/${A}`, { menu: menuNoStock.map((m) => ({ ...m, stock: "out" })) });
check("お店の人はメニューの中で残りを変えられない（送っても今のまま）", rs.json?.shop?.menu?.find((m) => m.id === itemA)?.stock === "few");
check("同じ英字の名前の品物が 2 つあると断る", (await a.req("PATCH", `/api/staff/shops/${A}`, { menu: [menuNoStock[0], menuNoStock[0]] })).status === 400);
check("お店の人は変更の記録を見られない", (await a.req("GET", "/api/staff/log")).status === 403);
const lg = await admin.req("GET", `/api/staff/log?shop=${A}`);
check("実行委員は変更の記録を見られ、お店の人の変更が残っている", lg.status === 200 && lg.json?.log?.some((e) => e.by === A && e.field === "どんなお店？" && e.after === mark));
check("売り切れだけの変更は記録に残らない", !lg.json?.log?.some((e) => e.field === "メニュー" && e.after.includes("few")));
check("紹介を元に戻す", (await a.req("PATCH", `/api/staff/shops/${A}`, { description: orig.description, menu: menuNoStock })).status === 200);

check("A の売り切れを元に戻す", (await a.req("PATCH", `/api/staff/shops/${A}`, { stock: [{ id: itemA, stock: "on" }] })).status === 200);

// 部門：足す → 名前と色を変える → お店がいる部門は消せない → 空なら消せる
check("実行委員は部門を足せる", (await admin.req("PUT", "/api/staff/depts/check-dept", { name: "テスト部門", short: "テスト", tagline: "", color: "teal", order: 999 })).status === 200);
check("ない部門にはお店を入れられない", (await admin.req("PATCH", `/api/staff/shops/${B}`, { dept: "nai-dept" })).status === 400);
const oldDept = (await admin.req("PATCH", `/api/staff/shops/${B}`, {})).json?.shop?.dept;
check("お店を新しい部門へ移せる", (await admin.req("PATCH", `/api/staff/shops/${B}`, { dept: "check-dept" })).status === 200);
check("お店がいる部門は消せない", (await admin.req("DELETE", "/api/staff/depts/check-dept")).status === 409);
check("お店を元の部門へ戻す", (await admin.req("PATCH", `/api/staff/shops/${B}`, { dept: oldDept })).status === 200);
check("空の部門は消せる", (await admin.req("DELETE", "/api/staff/depts/check-dept")).status === 200);

check("実行委員は QR を作り直せる", (await admin.req("POST", `/api/staff/shops/${A}/key`)).status === 200);
check("作り直したら前の QR の人は入れない", (await a.req("PATCH", `/api/staff/shops/${A}`, { state: "open" })).status === 401);
check("作り直したら前の QR では入り直せない", (await a.req("POST", "/api/staff/join", { shop: A, key: data.key[A] })).status === 401);
check("ログアウトできる", (await admin.req("POST", "/api/staff/logout")).status === 200);

console.log(failed ? `\n${failed} 件 NG` : "\nすべて OK");
process.exit(failed ? 1 : 0);
