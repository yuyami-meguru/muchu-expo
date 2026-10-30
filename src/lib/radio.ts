import { z } from "zod";

/*
 * 校内ラジオ。状態（ON AIR・いまの内容・番組表・メッセージ募集）は実行委員が変える。
 * 保存は getSetting/setSetting("radio")（JSON）。メッセージは pushList("radio-msg")、読んだ印は setSetting("radio-read")。
 * このファイルは画面とサーバーの両方で使う（server-only の物は入れない）。
 */

export type ProgramRow = { time: string; text: string };
export type RadioState = { onAir: boolean; now: string; program: ProgramRow[]; msgOpen: boolean; updatedAt: number };

export const RADIO_DEFAULT: RadioState = { onAir: false, now: "", program: [], msgOpen: true, updatedAt: 0 };

export function parseRadio(raw: string | null | undefined): RadioState {
  if (!raw) return RADIO_DEFAULT;
  try {
    const v = JSON.parse(raw) as Partial<RadioState>;
    return {
      onAir: !!v.onAir,
      now: typeof v.now === "string" ? v.now : "",
      program: Array.isArray(v.program) ? v.program.filter((p) => p && typeof p.text === "string").map((p) => ({ time: String(p.time ?? ""), text: p.text })) : [],
      msgOpen: v.msgOpen !== false,
      updatedAt: Number(v.updatedAt) || 0,
    };
  } catch {
    return RADIO_DEFAULT;
  }
}

/** お客さんに 15 秒ごとに配る分（番組表は入れない） */
export type RadioLive = { onAir: boolean; now: string };
export const radioLive = (s: RadioState): RadioLive => ({ onAir: s.onAir, now: s.onAir ? s.now : "" });

export const MSG_KINDS = ["質問", "メッセージ", "リクエスト", "クイズの答え"] as const;
export type MsgKind = (typeof MSG_KINDS)[number];
export type RadioMsg = { id: string; at: number; kind: MsgKind; name: string; text: string };

const t = (max: number) => z.string().trim().max(max);

/** 実行委員が送る状態（送った欄だけ変える） */
export const radioStateBody = z.object({
  onAir: z.boolean().optional(),
  now: t(60).optional(),
  program: z.array(z.object({ time: t(20), text: t(80).min(1) })).max(20).optional(),
  msgOpen: z.boolean().optional(),
});

/** お客さんのメッセージ */
export const radioMsgBody = z.object({
  kind: z.enum(MSG_KINDS),
  name: t(20).default(""),
  text: t(200).min(1),
  /** いたずら対策の見えない欄。人は入れない */
  website: t(100).default(""),
});

export function parseMsgs(raw: unknown[]): RadioMsg[] {
  const out: RadioMsg[] = [];
  for (const v of raw) {
    try {
      out.push(typeof v === "string" ? (JSON.parse(v) as RadioMsg) : (v as RadioMsg));
    } catch {
      // 壊れた 1 件は飛ばす
    }
  }
  return out;
}
