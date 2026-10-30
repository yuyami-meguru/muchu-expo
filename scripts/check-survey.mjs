// アンケートの守りを確かめる（手元の next dev に向けて実行）。 npm run check:survey
// 回答は消さない（テストの回答は 3〜4 件残る。集計の画面の「回答を全部消す」で消せる）
// アンケートは開催前は受け付けないので、はじめに表示の時期を「当日（開催中）」にし、最後に元の時期（ふつうは「日時で自動」）に戻す
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
const phaseBefore = (await anon.req("GET", "/api/status")).json?.phase ?? "auto";
await admin.req("PUT", "/api/staff/survey", { open: true });

// 開催前は断る（409）。練習で表示の時期を「当日」にしたときは受け付ける
check("実行委員は表示の時期を「開催前」にできる", (await admin.req("PUT", "/api/staff/phase", { mode: "before" })).status === 200);
const early = await anon.req("POST", "/api/survey", { who: "保護者", impression: "開催前のテスト" });
check("開催前はアンケートを受け付けない（409・当日からの案内）", early.status === 409 && /11\/28/.test(early.json?.error ?? ""), early.json?.error);
check("表示の時期を「当日（開催中）」にする", (await admin.req("PUT", "/api/staff/phase", { mode: "during" })).status === 200);
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

// 端末の印（device）：同じ端末の回答を 1 つに数えるため。形のちがう印は無いものとして保存する
const dev = `check${Date.now().toString(36)}`;
const devMark = `端末テスト${Date.now()}`;
check("端末の印をつけて答えられる", (await anon.req("POST", "/api/survey", { fav: [SHOP], impression: `${devMark}-1`, device: dev })).status === 200);
check("同じ端末からもう一度答えられる（数えるときに 1 つにまとめる）", (await anon.req("POST", "/api/survey", { fav: [SHOP], impression: `${devMark}-2`, device: dev })).status === 200);
check("形のちがう端末の印でも、回答は受け付ける", (await anon.req("POST", "/api/survey", { impression: `${devMark}-3`, device: "!!" })).status === 200);
const csvDev = (await admin.req("GET", "/api/staff/survey")).text.split("\r\n");
const devRows = csvDev.filter((l) => l.includes(devMark));
check("表（CSV）に端末の印の列がある", csvDev[0].includes("端末の印"));
check("同じ端末の 2 件は同じ印、形のちがう印は空で残る", devRows.filter((l) => l.endsWith(`,${dev}`)).length === 2 && devRows.some((l) => l.includes(`${devMark}-3`) && !l.includes("!!")), devRows.length);

check("ログインなしでは集計を見られない（ログインの案内）", (await anon.req("GET", "/api/staff/survey")).status === 401);
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

// 表示の時期を元に戻す（ふつうは「日時で自動」）
check(`表示の時期を元（${phaseBefore}）に戻す`, (await admin.req("PUT", "/api/staff/phase", { mode: phaseBefore })).status === 200);
check("戻したあとの表示の時期", (await anon.req("GET", "/api/status")).json?.phase === phaseBefore);

console.log(failed ? `\n${failed} 件 NG` : "\nすべて OK");
process.exit(failed ? 1 : 0);
