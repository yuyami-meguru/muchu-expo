// アンケートの守りを確かめる（手元の next dev に向けて実行）。 npm run check:survey
// 回答は消さない（テストの回答は 1〜2 件残る。集計の画面の「回答を全部消す」で消せる）
import { readFileSync } from "node:fs";

const BASE = process.env.BASE ?? "http://localhost:3470";
const PASS = process.env.ADMIN_PASSPHRASE ?? "dev-pass";
const data = JSON.parse(readFileSync(new URL("../.data/dev.json", import.meta.url), "utf8"));
const SHOP = Object.keys(data.key)[0];

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
      body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
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

const rows = async () => (await admin.req("GET", "/api/staff/survey")).text.split("\r\n").length - 1;
await admin.req("PUT", "/api/staff/survey", { open: true });
const before = await rows();

check("何も答えていないと送れない", (await anon.req("POST", "/api/survey", {})).status === 400);
check("ない選択肢は断る", (await anon.req("POST", "/api/survey", { who: "宇宙人" })).status === 400);
check("長すぎる感想は断る", (await anon.req("POST", "/api/survey", { impression: "あ".repeat(1001) })).status === 400);
check("ほかのサイトからは断る", (await anon.req("POST", "/api/survey", { who: "保護者" }, { origin: "https://evil.example" })).status === 403);
const mark = `テスト${Date.now()}`;
check(
  "ログインなしで答えられる",
  (await anon.req("POST", "/api/survey", { who: "保護者", how: ["チラシ", "このサイト"], transport: ["無料送迎バス"], fav: [SHOP, "nai-shop"], impression: mark })).status === 200,
);
check("見えない欄に入れた送りつけは、送れたふりで保存しない", (await anon.req("POST", "/api/survey", { who: "社会人", impression: "bot", website: "http://spam" })).status === 200);
const after = await rows();
check("保存されたのは 1 件だけ", after === before + 1, `${before} → ${after}`);

check("ログインなしでは集計を見られない", (await anon.req("GET", "/api/staff/survey")).status === 403);
check("お店の人は集計を見られない", (await shop.req("GET", "/api/staff/survey")).status === 403);
const csv = await admin.req("GET", "/api/staff/survey");
check("実行委員は表（CSV）で取り出せる", csv.status === 200 && csv.text.includes(mark));
check("ないお店は印象に残ったものから外す", !csv.text.split("\r\n").find((l) => l.includes(mark))?.includes("nai-shop"));
check("見えない欄の送りつけは表に無い", !csv.text.includes("http://spam"));
check("集計の画面は実行委員だけ", (await shop.req("GET", "/staff/survey")).status === 307);

check("お店の人は受付を止められない", (await shop.req("PUT", "/api/staff/survey", { open: false })).status === 403);
check("実行委員は受付を止められる", (await admin.req("PUT", "/api/staff/survey", { open: false })).status === 200);
check("止めているあいだは送れない", (await anon.req("POST", "/api/survey", { who: "保護者" })).status === 403);
check("受付を始め直せる", (await admin.req("PUT", "/api/staff/survey", { open: true })).status === 200);

check("お店の人は回答を消せない", (await shop.req("DELETE", "/api/staff/survey", { confirm: "消す" })).status === 403);
check("確認の言葉がないと消せない", (await admin.req("DELETE", "/api/staff/survey", { confirm: "x" })).status === 400);

console.log(failed ? `\n${failed} 件 NG` : "\nすべて OK");
process.exit(failed ? 1 : 0);
