import { z } from "zod";

/*
 * アンケート（2023 年のエンカレ祭アンケートの 5 問をもとにした）。
 * 名前・連絡先は聞かない。どの問いも答えなくてよい（送れるのは、少なくとも 1 問に答えたとき）。
 * 問 4 は、お店・出し物を選べるようにした（数で集計できる → 「夢中アワード」にも使える）。
 */

export const WHO_GROUPS = [
  { label: "エンカレ関係者", options: ["卒業生", "保護者", "兄弟姉妹", "親戚", "関係者（その他）"] },
  { label: "関係者以外", options: ["小学生", "中学生", "高校生", "大学生", "社会人"] },
] as const;
export const WHO = WHO_GROUPS.flatMap((g) => g.options) as readonly string[];

export const HOW = ["在校生", "卒業生", "保護者", "知人", "このサイト", "チラシ", "パンフレット", "Instagram", "学校見学"] as const;
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
});
export type SurveyInput = z.infer<typeof surveyBody>;

/** 保存する形（website は保存しない） */
export type SurveyAnswer = Omit<SurveyInput, "website"> & { at: number; v: 1 };

export function isEmptyAnswer(a: SurveyInput) {
  return !a.who && !a.how.length && !a.howOther && !a.transport.length && !a.transportOther && !a.fav.length && !a.favText && !a.impression;
}

const count = (items: string[], keys: readonly string[]) => {
  const m = new Map<string, number>(keys.map((k) => [k, 0]));
  for (const i of items) m.set(i, (m.get(i) ?? 0) + 1);
  return [...m.entries()].map(([label, n]) => ({ label, n }));
};

/** 集計：問いごとの数・自由記入・時間ごとの数（日本時間） */
export function summarize(answers: SurveyAnswer[], shopNames: Record<string, string>) {
  const favIds = answers.flatMap((a) => a.fav);
  const favKeys = Object.keys(shopNames);
  const fav = count(favIds, favKeys)
    .map((r) => ({ label: shopNames[r.label] ?? `（消えたお店：${r.label}）`, n: r.n }))
    .sort((a, b) => b.n - a.n);
  const hours = new Map<number, number>();
  for (const a of answers) {
    const h = new Date(a.at + 9 * 3600e3).getUTCHours();
    hours.set(h, (hours.get(h) ?? 0) + 1);
  }
  return {
    total: answers.length,
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
  const head = ["回答の日時", "あなたについて", "知ったきっかけ", "きっかけ（その他）", "交通手段", "交通手段（その他）", "印象に残ったお店・出し物", "印象に残ったもの（記入）", "感想"];
  const rows = answers.map((a) => [
    new Date(a.at + 9 * 3600e3).toISOString().slice(0, 16).replace("T", " "),
    a.who,
    a.how.join("・"),
    a.howOther,
    a.transport.join("・"),
    a.transportOther,
    a.fav.map((id) => shopNames[id] ?? id).join("・"),
    a.favText,
    a.impression,
  ]);
  return "﻿" + [head, ...rows].map((r) => r.map((c) => esc(String(c ?? ""))).join(",")).join("\r\n");
}
