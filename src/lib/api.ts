import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { ADMIN_ONLY, LOGIN_EXPIRED, getSession } from "./auth";
import { StoreNotReady } from "./store";

/** 失敗の返し方（画面にそのまま出せる日本語） */
export function fail(status: number, message: string) {
  return NextResponse.json({ ok: false, error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

/** 失敗に、画面が使う印を足して返す（409 の conflict など） */
export function failWith(status: number, message: string, extra: Record<string, unknown>) {
  return NextResponse.json({ ...extra, ok: false, error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export function ok<T extends object>(body: T = {} as T) {
  return NextResponse.json({ ok: true, ...body }, { headers: { "Cache-Control": "no-store" } });
}

/**
 * 実行委員だけの窓口の入口。ログインしていない・切れた → 401（画面は入り直し方を出す）、お店の人 → 403。
 * 実行委員なら null（そのまま続ける）
 */
export async function needAdmin(): Promise<NextResponse | null> {
  const s = await getSession();
  if (!s) return fail(401, LOGIN_EXPIRED);
  if (s.role !== "admin") return fail(403, ADMIN_ONLY);
  return null;
}

/**
 * 書き換えの API の入口のきまり：
 *  - 同じサイトの画面からだけ（Origin がちがえば断る）
 *  - 中身は JSON だけ（フォームの送りつけを断る）
 *  - 中身を zod で確かめる。opts.labels で欄の呼び名を変えられる（窓口ごとに画面の名前がちがうとき）、
 *    opts.invalid を渡すと、形がちがうときはいつもその文（QR の読み取りなど、中身を人が書いていないとき）
 */
export async function readBody<T extends z.ZodType>(
  req: NextRequest,
  schema: T,
  opts: { labels?: Record<string, string>; invalid?: string } = {},
): Promise<{ data: z.infer<T> } | { error: NextResponse }> {
  const origin = req.headers.get("origin");
  if (origin && origin !== req.nextUrl.origin) return { error: fail(403, "このサイトの画面から操作してください") };
  if (!req.headers.get("content-type")?.includes("application/json")) return { error: fail(415, "送り方がちがいます") };
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return { error: fail(400, opts.invalid ?? "送られた中身が読めません") };
  }
  const r = schema.safeParse(json);
  if (!r.success) return { error: fail(400, opts.invalid ?? issueText(r.error.issues[0], opts.labels)) };
  return { data: r.data };
}

/** 欄の英字の名前 → 画面での呼び名 */
const FIELD_LABEL: Record<string, string> = {
  name: "名前",
  price: "値段",
  note: "ひとこと説明",
  text: "文",
  time: "時刻",
  catch: "ひとこと",
  description: "どんなお店？",
  message: "お店の思い",
  notice: "お店からのお知らせ",
  menu: "メニュー",
  schedule: "当日の流れ",
  stock: "品物の残り",
  state: "お店の状態",
  dept: "部門",
  kind: "「何したい？」の分け方",
  placeId: "場所",
  placeNote: "場所の補足",
  hidden: "非表示",
  order: "並び順",
  short: "短い名前",
  building: "建物の名前",
  floor: "階",
  tagline: "ひとこと",
  id: "英字の名前",
  pass: "合言葉",
};

/** 数の単位（「メニューは 40 個まで」）と、何番目かの言い方（「メニューの 3 番目の名前」） */
const UNIT: Record<string, string> = { menu: "個", stock: "個", schedule: "行", program: "行", fav: "個", how: "個", transport: "個", ids: "件", awards: "個", winners: "件" };
const ORD: Record<string, string> = { schedule: "行目", program: "行目" };
/** リストの中の欄の呼び名（同じ英字でも、どのリストの中かで呼び方が変わる。空なら言わない） */
const IN_LIST: Record<string, Record<string, string>> = {
  menu: { name: "名前", price: "値段", note: "ひとこと説明", id: "英字の名前" },
  schedule: { time: "時刻", text: "すること" },
  program: { time: "時刻", text: "番組の内容" },
  stock: { id: "", stock: "" },
};
const JA = /[ぁ-んァ-ヶ一-龯]/;

/** zod の 1 件目の問題を、何をどう直せばいいかの日本語にする（例：「メニューの 2 番目の名前を入れてください」） */
function issueText(issue: z.core.$ZodIssue | undefined, labels: Record<string, string> = {}) {
  if (!issue) return "入れた内容を確かめてください";
  const path = issue.path.map(String);
  const parts: string[] = [];
  let list = "";
  for (let i = 0; i < path.length; i++) {
    const p = path[i];
    if (/^\d+$/.test(p)) {
      parts.push(`${Number(p) + 1} ${ORD[list] ?? "番目"}`);
      continue;
    }
    const inner = list && /^\d+$/.test(path[i - 1] ?? "") ? IN_LIST[list]?.[p] : undefined;
    const name = inner ?? labels[p] ?? FIELD_LABEL[p] ?? "";
    if (name) parts.push(name);
    list = p;
  }
  const where = parts.join("の").replace(/の(\d)/g, "の $1");
  const last = path.at(-1) ?? "";
  const what = where || "入れた内容";
  if (issue.code === "too_big" && "maximum" in issue) {
    if (issue.origin === "number") return `${what}は ${issue.maximum} までの数にしてください`;
    if (issue.origin === "array" || issue.origin === "set") return `${what}は ${issue.maximum} ${UNIT[last] ?? "個"}までです`;
    return `${what}が長すぎます（${issue.maximum} 字まで）`;
  }
  if (issue.code === "too_small" && "minimum" in issue) {
    if (issue.origin === "number") return `${what}は ${issue.minimum} 以上の数にしてください`;
    if (issue.origin === "array" || issue.origin === "set") return `${what}を 1 つ以上選んでください`;
    return Number(issue.minimum) > 1 ? `${what}が短すぎます` : `${what}を入れてください`;
  }
  if (issue.code === "invalid_format" || last === "id") return "英字の名前は、小文字の a〜z・数字・「-」だけにしてください";
  // refine で書いた日本語の文（「品物の英字の名前が重なっています」など）はそのまま
  if (issue.code === "custom" && JA.test(issue.message)) return issue.message;
  return where ? `${where}を確かめてください` : "入れた内容を確かめてください。画面を読み込み直すと直ることがあります";
}

/** Origin だけ確かめる（中身のない操作：ログアウト・削除など） */
export function sameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  return !origin || origin === req.nextUrl.origin;
}

export function clientIp(req: NextRequest) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}

/** 保存先が未設定のときのエラーをわかる文にする */
export async function guarded(fn: () => Promise<NextResponse>) {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof StoreNotReady) return fail(503, "いまは保存できません（保存先につながっていません）。実行委員か、サイト担当（AVERIX）に知らせてください");
    console.error(e);
    return fail(500, "保存できませんでした。電波のよい所で、少ししてからもう一度ためしてください");
  }
}

/* ───── 入力のきまり ───── */
const text = (max: number) => z.string().trim().max(max);
export const zId = z.string().regex(/^[a-z0-9-]{1,40}$/);
export const zStock = z.enum(["on", "few", "out"]);
export const zState = z.enum(["prep", "open", "break", "closed"]);
export const zKind = z.enum(["eat", "play", "see"]);
/** 端末ごとの乱数（アンケート・ラジオ。同じ端末の回答を 1 つに数えるため）。形がちがえば無いものとして扱う */
export const zDevice = z.string().trim().regex(/^[A-Za-z0-9_-]{8,40}$/).optional().catch(undefined);

/** 品物の中身（名前・値段・メモ）。残り（stock）は送らなくてよい */
const zMenuItem = z.object({ id: zId, name: text(40).min(1), price: text(30), note: text(60), stock: zStock.optional() });
const zMenu = z
  .array(zMenuItem)
  .max(40)
  .refine((list) => new Set(list.map((m) => m.id)).size === list.length, "品物の英字の名前が重なっています");
const zSchedule = z.array(z.object({ time: text(20), text: text(80).min(1) })).max(30);

/**
 * お店の人が変えられるもの：状態・お知らせ・品物ごとの残り ＋ お店の紹介（ひとこと・どんなお店？・思い・当日の流れ・メニュー）。
 * メニューの残り（stock）はここでは変えない（送っても今の値のまま。残りは stock の配列で変える）。
 * base（任意）：送る欄と同じ名前の欄に、画面を開いたときの値。いまの保存の値とちがう欄があれば、書かずに 409（ほかの人が直した）
 */
export const shopPatch = z.object({
  state: zState.optional(),
  notice: text(120).optional(),
  stock: z.array(z.object({ id: zId, stock: zStock })).max(40).optional(),
  catch: text(60).optional(),
  description: text(600).optional(),
  message: text(600).optional(),
  menu: zMenu.optional(),
  schedule: zSchedule.optional(),
  base: z.record(z.string(), z.unknown()).optional(),
});

/** 実行委員が変えられるもの（お店の人の分も含む）。メニューの残りも直せる */
export const adminShopPatch = shopPatch.extend({
  name: text(40).min(1).optional(),
  dept: zId.optional(),
  kind: zKind.optional(),
  placeId: z.union([zId, z.literal("")]).optional(),
  placeNote: text(60).optional(),
  hidden: z.boolean().optional(),
  order: z.number().int().min(0).max(9999).optional(),
});

export const placeBody = z.object({
  kind: z.enum(["spot", "building", "info", "toilet", "aid", "rest", "gate"]).default("spot"),
  /** どの面か（外は "outside"） */
  area: z.union([zId, z.literal("outside")]).default("outside"),
  /** 部屋の四角の幅と高さ（割合）。どちらも 0 ならピン */
  w: z.number().min(0).max(100).default(0),
  h: z.number().min(0).max(100).default(0),
  name: text(30).min(1),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  note: text(60),
});

export const deptBody = z.object({
  name: text(20).min(1),
  short: text(8).min(1),
  tagline: text(40),
  color: z.enum(["blue", "orange", "red", "purple", "green", "teal", "pink", "brown"]),
  order: z.number().int().min(0).max(9999),
});

/** フロア（建物の中の面）。見取り図の画像は別の窓口で */
export const areaBody = z.object({
  building: text(20).min(1),
  floor: text(12).min(1),
  order: z.number().int().min(0).max(9999),
});

export const newsBody = z.object({ text: text(140).min(1), pinned: z.boolean().default(false) });
