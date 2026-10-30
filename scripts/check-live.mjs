// 当日の操作（売り切れ・状態・呼び出し・連絡・全体の帯・表示の時期・チェックリスト）を確かめる（手元の next dev に向けて実行）。
//   npm run dev のあとで  npm run check:live
// とくに「同時に押しても、ほかの人の変更が消えない」こと。最後に元に戻す。本番には向けない。
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

const admin = new Client();
await admin.req("POST", "/api/staff/login", { pass: PASS });
const a = new Client();
await a.req("POST", "/api/staff/join", { shop: A, key: data.key[A] });
const b = new Client();
await b.req("POST", "/api/staff/join", { shop: B, key: data.key[B] });

const full = async (id) => (await admin.req("GET", `/api/staff/live`)).json.shops[id];
const orig = (await a.req("PATCH", `/api/staff/shops/${A}`, {})).json.shop;
const origLive = await full(A);
check("実行委員の「いまの様子」で全部のお店が読める", !!origLive && Object.keys((await admin.req("GET", "/api/staff/live")).json.shops).length >= 2);
const items = Object.keys(origLive.stock);

// 1. お店が売り切れにした後、実行委員が古い画面のまま中身を保存しても、売り切れは消えない
const shopRes = await admin.req("GET", "/api/staff/live");
const stale = shopRes.json.shops[A];
await a.req("PATCH", `/api/staff/shops/${A}`, { stock: [{ id: items[0], stock: "out" }] });
const menuStale = (await a.req("PATCH", `/api/staff/shops/${A}`, {})).json.shop.menu.map((m) => ({ ...m, stock: stale.stock[m.id] }));
await admin.req("PATCH", `/api/staff/shops/${A}`, { name: "エンカレ茶屋", menu: menuStale });
check("中身の保存で、お店が押した売り切れが戻らない", (await full(A)).stock[items[0]] === "out");

// 2. 同じお店の別の品物を同時に押しても、全部残る
await Promise.all(items.map((id, i) => (i % 2 ? a : admin).req("PATCH", `/api/staff/shops/${A}`, { stock: [{ id, stock: "few" }] })));
check("同時に押した品物が全部「残りわずか」になる", Object.values((await full(A)).stock).every((v) => v === "few"));

// 3. 全部を営業中にしても、売り切れ・お知らせは消えない
await a.req("PATCH", `/api/staff/shops/${A}`, { notice: "テストのお知らせ" });
await admin.req("POST", "/api/staff/open-all", {});
const afterOpen = await full(A);
check("全部を営業中：状態が営業中", afterOpen.state === "open" || afterOpen.hidden);
check("全部を営業中：お知らせ・残りはそのまま", afterOpen.notice === "テストのお知らせ" && Object.values(afterOpen.stock).every((v) => v === "few"));
await admin.req("POST", "/api/staff/close-all", {});
check("全部を終了にできる", (await full(A)).state === "closed" || afterOpen.hidden);

// 4. お店の人の「いまの様子」は自分のお店だけ
const mine = (await a.req("GET", "/api/staff/live")).json;
check("お店の人の「いまの様子」は自分のお店だけ", !!mine.shop && !mine.shops && mine.shop.notice === "テストのお知らせ");
check("ログインなしでは「いまの様子」を読めない", (await new Client().req("GET", "/api/staff/live")).status === 401);

// 5. 呼び出し
const call = await a.req("POST", "/api/staff/calls", { reason: "おつり・お金", text: "千円札が足りません" });
check("お店から実行委員を呼べる", call.status === 200 && !!call.json.call?.id);
const id = call.json.call.id;
check("実行委員の画面に呼び出しが出る", (await admin.req("GET", "/api/staff/live")).json.calls.some((c) => c.id === id && c.status === "new"));
check("ほかのお店は、その呼び出しを変えられない", (await b.req("PATCH", `/api/staff/calls/${id}`, { status: "done" })).status === 403);
check("お店の人は「向かっています」にはできない", (await a.req("PATCH", `/api/staff/calls/${id}`, { status: "going" })).status === 403);
check("実行委員が「向かっています」にできる", (await admin.req("PATCH", `/api/staff/calls/${id}`, { status: "going" })).status === 200);
check("お店の画面に「向かっています」が出る", (await a.req("GET", "/api/staff/live")).json.calls.some((c) => c.id === id && c.status === "going"));
check("ほかのお店には、その呼び出しは見えない", !(await b.req("GET", "/api/staff/live")).json.calls.some((c) => c.id === id));
check("お店の人が「済み」にできる", (await a.req("PATCH", `/api/staff/calls/${id}`, { status: "done" })).status === 200);
check("実行委員は呼び出しを作れない（お店の人だけ）", (await admin.req("POST", "/api/staff/calls", { reason: "その他", text: "" })).status === 403);

// 6. お店の人への連絡
check("お店の人は連絡を出せない", (await a.req("PUT", "/api/staff/memo", { text: "x" })).status === 403);
const memo = await admin.req("PUT", "/api/staff/memo", { text: "13:45 で販売を締めてください" });
check("実行委員がお店の人へ連絡を出せる", memo.status === 200 && !!memo.json.memo?.id);
const seen = (await a.req("GET", "/api/staff/live")).json;
check("お店の画面に連絡が出る（まだ読んでいない）", seen.memo?.text === "13:45 で販売を締めてください" && seen.acked === false);
await a.req("POST", "/api/staff/memo/ack", { id: memo.json.memo.id });
check("「見ました」を押すと読んだ印が付く", (await a.req("GET", "/api/staff/live")).json.acked === true);
check("実行委員の画面で、読んだお店がわかる", (await admin.req("GET", "/api/staff/live")).json.acks[A] === memo.json.memo.id);
check("お客さんの「いまの様子」に連絡は出ない", !JSON.stringify(await fetch(`${BASE}/api/status`).then((r) => r.json())).includes("13:45 で販売を締めて"));
await admin.req("PUT", "/api/staff/memo", { text: "" });
check("連絡を消せる", (await a.req("GET", "/api/staff/live")).json.memo === null);

// 7. 全体の帯・表示の時期
check("お店の人は全体の帯を出せない", (await a.req("PUT", "/api/staff/alert", { on: true, level: "rain", text: "x" })).status === 403);
check("文のない帯は出せない", (await admin.req("PUT", "/api/staff/alert", { on: true, level: "rain", text: "" })).status === 400);
await admin.req("PUT", "/api/staff/alert", { on: true, level: "rain", text: "雨のため屋内に移っています" });
let st = await fetch(`${BASE}/api/status`, { cache: "no-store" }).then((r) => r.json());
check("全体の帯がお客さんの「いまの様子」に乗る", st.alert?.level === "rain" && st.alert?.text === "雨のため屋内に移っています");
await admin.req("PUT", "/api/staff/alert", { on: false, level: "rain", text: "雨のため屋内に移っています" });
st = await fetch(`${BASE}/api/status`, { cache: "no-store" }).then((r) => r.json());
check("全体の帯を消せる", st.alert === null);
await admin.req("PUT", "/api/staff/phase", { mode: "during" });
st = await fetch(`${BASE}/api/status`, { cache: "no-store" }).then((r) => r.json());
check("表示の時期を「当日」にできる", st.phase === "during");
await admin.req("PUT", "/api/staff/phase", { mode: "auto" });
check("表示の時期を「日時で自動」に戻せる", (await fetch(`${BASE}/api/status`, { cache: "no-store" }).then((r) => r.json())).phase === "auto");

// 8. チェックリスト
check("チェックリストに印を付けられる", (await admin.req("PUT", "/api/staff/check", { id: "qr", done: true })).status === 200);
check("ない項目には付けられない", (await admin.req("PUT", "/api/staff/check", { id: "nope", done: true })).status === 400);
await admin.req("PUT", "/api/staff/check", { id: "qr", done: false });

// 9. 品物を消して同じ英字の名前で足しても、前の売り切れは付かない
const menu0 = (await a.req("PATCH", `/api/staff/shops/${A}`, {})).json.shop.menu;
await a.req("PATCH", `/api/staff/shops/${A}`, { stock: [{ id: menu0[0].id, stock: "out" }] });
await admin.req("PATCH", `/api/staff/shops/${A}`, { menu: menu0.slice(1).map(({ id, name, price, note }) => ({ id, name, price, note })) });
await admin.req("PATCH", `/api/staff/shops/${A}`, { menu: menu0.map(({ id, name, price, note }) => ({ id, name, price, note })) });
check("消して足した品物は「販売中」で始まる", (await full(A)).stock[menu0[0].id] === "on");

// 元に戻す
await admin.req("PATCH", `/api/staff/shops/${A}`, { name: orig.name, menu: orig.menu.map(({ id, name, price, note }) => ({ id, name, price, note })) });
await admin.req("PATCH", `/api/staff/shops/${A}`, {
  state: origLive.state,
  notice: origLive.notice,
  stock: Object.entries(origLive.stock).map(([id, stock]) => ({ id, stock })),
});
const back = await full(A);
check("元に戻した", back.state === origLive.state && back.notice === origLive.notice && JSON.stringify(back.stock) === JSON.stringify(origLive.stock));
// 全部を営業中・終了にしたほかのお店も戻す
for (const [id, s] of Object.entries(shopRes.json.shops)) {
  if (id !== A) await admin.req("PATCH", `/api/staff/shops/${id}`, { state: s.state });
}

console.log(failed ? `\n${failed} 件 NG` : "\nすべて OK");
process.exit(failed ? 1 : 0);
