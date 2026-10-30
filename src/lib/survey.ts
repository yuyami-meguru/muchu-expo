import { z } from "zod";

/*
 * アンケート（2023 年のエンカレ祭アンケートの 5 問をもとにした）。
 * 名前・連絡先は聞かない。どの問いも答えなくてよい（送れるのは、少なくとも 1 問に答えたとき）。
 * 問 4 は、お店・出し物を選べるようにした（数で集計できる → 「夢中アワード」にも使える）。
 */

export const WHO_GROUPS = [
  { label: "エンカレ関係者", options: ["卒業生", "保護者", "兄弟姉妹", "親戚", "関係者（その他）"] },
  { label: "関係者以外", options: ["小学生", "中学生", "高校生", "大学生", "社会人", "地域の方", "その他"] },
] as const;
export const WHO = WHO_GROUPS.flatMap((g) => g.options) as readonly string[];

export const HOW = ["在校生", "卒業生", "保護者", "知人", "このサイト", "チラシ", "パンフレット", "Instagram", "学校見学"] as const;
/** 画面に出す言い方（保存する値は HOW のまま。人の名前だけだと「自分のこと」を選ぶ問いと読みまちがえるため） */
export const HOW_LABEL: Record<(typeof HOW)[number], string> = {
  在校生: "在校生から聞いた",
  卒業生: "卒業生から聞いた",
  保護者: "保護者から聞いた",
  知人: "知り合いから聞いた",
  このサイト: "このサイト",
  チラシ: "チラシ",
  パンフレット: "パンフレット",
  Instagram: "Instagram",
  学校見学: "学校見学・説明会",
};
export const TRANSPORT = ["無料送迎バス", "路線バス", "車", "自転車", "徒歩"] as const;

const t = (max: number) => z.string().trim().max(max);

export const surveyBody = z.object({
  who: z.union([z.enum(WHO as [string, ...string[]]), z.literal("")]).default(""),
  how: z.array(z.enum(HOW)).max(HOW.length).default([]),
  howOther: t(40).default(""),
  transport: z.array(z.enum(TRANSPORT)).max(TRANSPORT.length).default([]),
  transportOther: t(40).default(""),
  /** 印象に残ったお店・出し物（お店の id） */
  fav: z.array(z.string().regex(/^[a-z0-9-]{1,40}$/)).max(20).default([]),
  favText: t(300).default(""),
  impression: t(1000).default(""),
  /** いたずら対策の見えない欄。人は入れない */
  website: t(100).default(""),
  /**
   * 端末ごとの乱数（v0.12.0 から。画面が localStorage に残して送る）。同じ端末の回答を 1 つに数えるときに使う。
   * 人の情報ではない。形がちがえば無いものとして扱う（古い画面は送らない）
   */
  device: z.string().trim().regex(/^[A-Za-z0-9_-]{8,40}$/).optional().catch(undefined),
});
export type SurveyInput = z.infer<typeof surveyBody>;

/** 保存する形（website は保存しない。device は送られたときだけ） */
export type SurveyAnswer = Omit<SurveyInput, "website"> & { at: number; v: 1 };

/** 送られた中身がちがうときの、欄の呼び名（画面の問いの名前） */
export const SURVEY_LABELS: Record<string, string> = {
  who: "あなたについて",
  how: "知ったきっかけ",
  howOther: "きっかけ（その他）",
  transport: "ここまで来た方法",
  transportOther: "来た方法（その他）",
  fav: "印象に残ったお店・出し物",
  favText: "印象に残ったもの",
  impression: "感想",
};

export function isEmptyAnswer(a: SurveyInput) {
  return !a.who && !a.how.length && !a.howOther && !a.transport.length && !a.transportOther && !a.fav.length && !a.favText && !a.impression;
}

const count = (items: string[], keys: readonly string[]) => {
  const m = new Map<string, number>(keys.map((k) => [k, 0]));
  for (const i of items) m.set(i, (m.get(i) ?? 0) + 1);
  return [...m.entries()].map(([label, n]) => ({ label, n }));
};

/** 同じ端末の回答を 1 つに数えたときの回答の数（端末の印が無い回答は 1 つずつ数える） */
export function deviceCount(answers: Pick<SurveyAnswer, "device">[]) {
  const seen = new Set<string>();
  let n = 0;
  for (const a of answers) {
    if (!a.device) n++;
    else if (!seen.has(a.device)) {
      seen.add(a.device);
      n++;
    }
  }
  return n;
}

/**
 * 印象に残ったお店・出し物の数（お店 id → 数）。byDevice なら、同じ端末が何回答えても 1 つのお店には 1 票
 * （続けて何度も答えると票が増えるので、アワードを決めるときはこちらも見る）
 */
export function favCounts(answers: Pick<SurveyAnswer, "fav" | "device">[], byDevice = false): Record<string, number> {
  const out: Record<string, number> = {};
  const seen = new Set<string>();
  for (const a of answers) {
    for (const id of new Set(a.fav ?? [])) {
      if (byDevice && a.device) {
        const k = `${a.device}\n${id}`;
        if (seen.has(k)) continue;
        seen.add(k);
      }
      out[id] = (out[id] ?? 0) + 1;
    }
  }
  return out;
}

/** 集計：問いごとの数・自由記入・時間ごとの数（日本時間）。totalByDevice・favByDevice は同じ端末の回答を 1 つに数えたもの */
export function summarize(answers: SurveyAnswer[], shopNames: Record<string, string>) {
  const favIds = answers.flatMap((a) => a.fav ?? []);
  const favKeys = Object.keys(shopNames);
  const nameOf = (id: string) => shopNames[id] ?? `（消えたお店：${id}）`;
  const fav = count(favIds, favKeys)
    .map((r) => ({ label: nameOf(r.label), n: r.n }))
    .sort((a, b) => b.n - a.n);
  const byDevice = favCounts(answers, true);
  const favByDevice = [...new Set([...favKeys, ...Object.keys(byDevice)])]
    .map((id) => ({ label: nameOf(id), n: byDevice[id] ?? 0 }))
    .sort((a, b) => b.n - a.n);
  const hours = new Map<number, number>();
  for (const a of answers) {
    const h = new Date(a.at + 9 * 3600e3).getUTCHours();
    hours.set(h, (hours.get(h) ?? 0) + 1);
  }
  return {
    total: answers.length,
    totalByDevice: deviceCount(answers),
    favByDevice,
    who: count(answers.map((a) => a.who).filter(Boolean), WHO),
    whoBlank: answers.filter((a) => !a.who).length,
    how: count(answers.flatMap((a) => a.how), HOW),
    howOther: answers.filter((a) => a.howOther).map((a) => ({ at: a.at, text: a.howOther })),
    transport: count(answers.flatMap((a) => a.transport), TRANSPORT),
    transportOther: answers.filter((a) => a.transportOther).map((a) => ({ at: a.at, text: a.transportOther })),
    fav,
    favText: answers.filter((a) => a.favText).map((a) => ({ at: a.at, text: a.favText })),
    impression: answers.filter((a) => a.impression).map((a) => ({ at: a.at, text: a.impression, who: a.who })),
    hours: [...hours.entries()].sort((a, b) => a[0] - b[0]).map(([h, n]) => ({ label: `${h}時台`, n })),
  };
}

/** 先生に渡す表（CSV。Excel で開けるように頭に BOM を付ける） */
export function toCsv(answers: SurveyAnswer[], shopNames: Record<string, string>) {
  // = + - @ で始まる文は、Excel が式として動かさないよう前に ' を付ける
  const esc = (raw: string) => {
    const v = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
    return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  };
  const head = ["回答の日時", "あなたについて", "知ったきっかけ", "きっかけ（その他）", "交通手段", "交通手段（その他）", "印象に残ったお店・出し物", "印象に残ったもの（記入）", "感想", "端末の印（同じ端末の回答は同じ印）"];
  const rows = answers.map((a) => [
    new Date(a.at + 9 * 3600e3).toISOString().slice(0, 16).replace("T", " "),
    a.who,
    a.how.join("・"),
    a.howOther,
    a.transport.join("・"),
    a.transportOther,
    (a.fav ?? []).map((id) => shopNames[id] ?? id).join("・"),
    a.favText,
    a.impression,
    a.device ?? "",
  ]);
  return "﻿" + [head, ...rows].map((r) => r.map((c) => esc(String(c ?? ""))).join(",")).join("\r\n");
}
