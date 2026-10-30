// 校内ラジオの守りを確かめる（手元の next dev に向けて実行）。 npm run check:radio
// テストのあと、ラジオの状態は元に戻す（ON AIR はオフ）。テストで送ったメッセージ（4 通）は残る（実行委員の画面で消せる）
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
    let json = null;
    try {
      json = await r.json();
    } catch {}
    return { status: r.status, json };
  }
}

const anon = new Client();
const admin = new Client();
await admin.req("POST", "/api/staff/login", { pass: PASS });
const shop = new Client();
await shop.req("POST", "/api/staff/join", { shop: SHOP, key: data.key[SHOP] });

const before = (await admin.req("GET", "/api/staff/radio")).json?.state;
check("実行委員は状態を読める", !!before);
const count = async () => (await admin.req("GET", "/api/staff/radio")).json?.messages?.length ?? -1;

check("ログインなしでは状態を変えられない（ログインの案内）", (await anon.req("PUT", "/api/staff/radio", { onAir: true })).status === 401);
check("お店の人は状態を変えられない", (await shop.req("PUT", "/api/staff/radio", { onAir: true })).status === 403);
check("お店の人はメッセージ一覧を見られない", (await shop.req("GET", "/api/staff/radio")).status === 403);
check("ログインなしではメッセージ一覧を見られない", (await anon.req("GET", "/api/staff/radio")).status === 401);
check("お店の人は読んだ印を付けられない", (await shop.req("PUT", "/api/staff/radio/read", { ids: ["abcdef"], read: true })).status === 403);
check("お店の人はメッセージを消せない", (await shop.req("DELETE", "/api/staff/radio", { confirm: "消す" })).status === 403);

check("実行委員は ON AIR にできる", (await admin.req("PUT", "/api/staff/radio", { onAir: true, now: "テスト放送中", msgOpen: true })).status === 200);
const live = (await anon.req("GET", "/api/status")).json?.radio;
check("いまの様子に ON AIR が出る", live?.onAir === true && live?.now === "テスト放送中", JSON.stringify(live));
check("長すぎる「いまの内容」は断る", (await admin.req("PUT", "/api/staff/radio", { now: "あ".repeat(61) })).status === 400);
check("21 行の番組表は断る", (await admin.req("PUT", "/api/staff/radio", { program: Array.from({ length: 21 }, () => ({ time: "10:00", text: "x" })) })).status === 400);

const n0 = await count();
// 同じ文の送り直しは 10 分は 1 通にまとめるので、試すたびにちがう文にする
const msgText = `テストの質問です ${Date.now()}`;
check("ログインなしでメッセージを送れる", (await anon.req("POST", "/api/radio/message", { kind: "質問", name: "テスト", text: msgText })).status === 200);
check("空のメッセージは断る", (await anon.req("POST", "/api/radio/message", { kind: "質問", text: "  " })).status === 400);
check("長すぎるメッセージは断る", (await anon.req("POST", "/api/radio/message", { kind: "質問", text: "あ".repeat(201) })).status === 400);
check("ない種類は断る", (await anon.req("POST", "/api/radio/message", { kind: "悪口", text: "x" })).status === 400);
check("長すぎるラジオネームは断る", (await anon.req("POST", "/api/radio/message", { kind: "質問", name: "あ".repeat(21), text: "x" })).status === 400);
check("ほかのサイトからは断る", (await anon.req("POST", "/api/radio/message", { kind: "質問", text: "x" }, { origin: "https://evil.example" })).status === 403);
check("見えない欄の送りつけは、送れたふりで保存しない", (await anon.req("POST", "/api/radio/message", { kind: "質問", text: "bot", website: "http://spam" })).status === 200);
check("同じ文を続けて送っても、送れたことになる", (await anon.req("POST", "/api/radio/message", { kind: "質問", name: "テスト", text: msgText })).status === 200);
const n1 = await count();
check("保存されたのは 1 通だけ（送りつけと送り直しは残さない）", n1 === n0 + 1, `${n0} → ${n1}`);
// 端末の印があれば、同じ文の送り直しは端末ごとに見る。クイズの答えは、印が無ければ同じ文でも残す（みんな同じ答えになるので）
const quiz = `A ${Date.now()}`;
await anon.req("POST", "/api/radio/message", { kind: "クイズの答え", text: quiz });
await anon.req("POST", "/api/radio/message", { kind: "クイズの答え", text: quiz });
const n2 = await count();
check("クイズの答えは、端末の印が無ければ同じ文でも残す", n2 === n1 + 2, `${n1} → ${n2}`);
const dev = `check${Date.now().toString(36)}`;
await anon.req("POST", "/api/radio/message", { kind: "クイズの答え", text: quiz, device: dev });
await anon.req("POST", "/api/radio/message", { kind: "クイズの答え", text: quiz, device: dev });
const n3 = await count();
check("同じ端末から同じ答えを 2 回送っても 1 通", n3 === n2 + 1, `${n2} → ${n3}`);
const first = (await admin.req("GET", "/api/staff/radio")).json?.messages?.[0];
check("届いたメッセージに id が付く", /^[a-f0-9]{10}$/.test(first?.id ?? ""));
const marked = await admin.req("PUT", "/api/staff/radio/read", { ids: [first.id], read: true });
check("実行委員は読んだ印を付けられる", marked.status === 200 && marked.json.readIds.includes(first.id));
await admin.req("PUT", "/api/staff/radio/read", { ids: [first.id], read: false });

check("実行委員は募集を止められる", (await admin.req("PUT", "/api/staff/radio", { msgOpen: false })).status === 200);
check("募集を止めているあいだは送れない", (await anon.req("POST", "/api/radio/message", { kind: "質問", text: "x" })).status === 403);
check("確認の言葉がないと消せない", (await admin.req("DELETE", "/api/staff/radio", { confirm: "x" })).status === 400);

// 元に戻す（ON AIR はオフ）
const back = await admin.req("PUT", "/api/staff/radio", { onAir: false, now: before.now, program: before.program, msgOpen: before.msgOpen });
check("状態を元に戻す（ON AIR はオフ）", back.status === 200 && back.json.state.onAir === false);
check("戻したあと、いまの様子は放送していない", (await anon.req("GET", "/api/status")).json?.radio?.onAir === false);

console.log(failed ? `\n${failed} 件 NG` : "\nすべて OK");
process.exit(failed ? 1 : 0);
