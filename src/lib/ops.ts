import { z } from "zod";
import type { ShopState, Stock } from "./types";

/*
 * 当日の運営の道具（画面とサーバーの両方で使う。server-only の物は入れない）。
 *  - 全体の帯：雨・急ぎの知らせを、お客さん側の全部のページのいちばん上に出す（setting "alert"）
 *  - 表示の時期：開催前・当日・終了後でホームの出し方を変える。ふだんは日時で自動、練習のときは実行委員が切り替える（setting "phase"）
 *  - 呼び出し：お店の人 → 実行委員（ハッシュ muchu:call）
 *  - お店の人への連絡：実行委員 → 全部のお店（お客さんには見えない。setting "memo"、読んだ印はハッシュ muchu:memo-ack）
 *  - 当日のチェックリスト（ハッシュ muchu:check）
 */

/* ───── 開催の時刻（日本時間） ───── */
export const DAY_START = Date.parse("2026-11-28T00:00:00+09:00");
export const OPEN_AT = Date.parse("2026-11-28T10:00:00+09:00");
export const CLOSE_AT = Date.parse("2026-11-28T14:00:00+09:00");

/** before＝開催日より前、morning＝当日の 10:00 まで、during＝10:00〜14:00、after＝14:00 から */
export type Phase = "before" | "morning" | "during" | "after";
export type PhaseMode = "auto" | "before" | "during" | "after";
export const PHASE_MODES: { value: PhaseMode; label: string; hint: string }[] = [
  { value: "auto", label: "日時で自動", hint: "ふだんはこれ。11/28 の 10:00 に「当日」、14:00 に「終了後」に変わります" },
  { value: "before", label: "開催前", hint: "売り切れ・営業中の札を出さず、「当日 10:00 から出ます」と案内します" },
  { value: "during", label: "当日（開催中）", hint: "前日の練習のときに。売り切れ・営業中の札が出ます" },
  { value: "after", label: "終了後", hint: "「本日は終了しました」と出し、アンケートと受賞の発表を前に出します" },
];

export function phaseOf(now: number, mode: PhaseMode = "auto"): Phase {
  if (mode === "before" || mode === "after") return mode;
  if (mode === "during") return "during";
  if (now < DAY_START) return "before";
  if (now < OPEN_AT) return "morning";
  if (now < CLOSE_AT) return "during";
  return "after";
}

export function parsePhaseMode(raw: string | null | undefined): PhaseMode {
  return raw === "before" || raw === "during" || raw === "after" ? raw : "auto";
}

/* ───── 全体の帯 ───── */
export type AlertLevel = "info" | "rain" | "urgent";
export type SiteAlert = { on: boolean; level: AlertLevel; text: string; at: number };
export const ALERT_LEVELS: { value: AlertLevel; label: string; preset: string }[] = [
  { value: "info", label: "ふつうのお知らせ（青）", preset: "" },
  { value: "rain", label: "雨（黄）", preset: "雨のため、屋外のお店は屋内に移っています。場所は各お店のページでご確認ください。坂道は足元にお気をつけください。" },
  { value: "urgent", label: "急ぎ（赤）", preset: "ただいま、近くの係（生徒・先生）の案内に従ってください。" },
];
export const ALERT_OFF: SiteAlert = { on: false, level: "info", text: "", at: 0 };

export function parseAlert(raw: string | null | undefined): SiteAlert {
  if (!raw) return ALERT_OFF;
  try {
    const v = JSON.parse(raw) as Partial<SiteAlert>;
    const level = ALERT_LEVELS.some((l) => l.value === v.level) ? (v.level as AlertLevel) : "info";
    return { on: !!v.on && typeof v.text === "string" && !!v.text.trim(), level, text: typeof v.text === "string" ? v.text : "", at: Number(v.at) || 0 };
  } catch {
    return ALERT_OFF;
  }
}

const t = (max: number) => z.string().trim().max(max);
export const alertBody = z.object({ on: z.boolean(), level: z.enum(["info", "rain", "urgent"]), text: t(140) });
export const phaseBody = z.object({ mode: z.enum(["auto", "before", "during", "after"]) });

/* ───── 呼び出し（お店の人 → 実行委員） ───── */
export const CALL_REASONS = ["おつり・お金", "人手が足りない", "材料・物が足りない", "けが・体調", "機械・電気", "その他"] as const;
export type CallReason = (typeof CALL_REASONS)[number];
export type CallStatus = "new" | "going" | "done";
export const CALL_STATUS_LABEL: Record<CallStatus, string> = { new: "まだ", going: "向かっています", done: "済み" };
export type Call = { id: string; shop: string; reason: CallReason; text: string; at: number; status: CallStatus; updatedAt: number };

export const callBody = z.object({ reason: z.enum(CALL_REASONS), text: t(80).default("") });
export const callPatch = z.object({ status: z.enum(["going", "done"]) });

export function parseCalls(rec: Record<string, string>): Call[] {
  const out: Call[] = [];
  for (const v of Object.values(rec)) {
    try {
      const c = JSON.parse(v) as Call;
      if (c && typeof c.id === "string" && typeof c.shop === "string") out.push(c);
    } catch {
      // 壊れた 1 件は飛ばす
    }
  }
  return out.sort((a, b) => b.at - a.at);
}

/* ───── お店の人への連絡（実行委員 → 全部のお店） ───── */
export type Memo = { id: string; text: string; at: number };
export const memoBody = z.object({ text: t(200) });

export function parseMemo(raw: string | null | undefined): Memo | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Memo;
    return v && typeof v.text === "string" && v.text && typeof v.id === "string" ? v : null;
  } catch {
    return null;
  }
}

/* ───── 当日のチェックリスト ───── */
export const CHECK_ITEMS: { id: string; when: "前日まで" | "当日の朝" | "終わったら"; text: string }[] = [
  { id: "qr", when: "前日まで", text: "お店の人に配る QR を各お店に渡した" },
  { id: "poster", when: "前日まで", text: "会場に貼るポスターを印刷して貼った" },
  { id: "content", when: "前日まで", text: "全部のお店の紹介・メニュー・値段・場所が入っている（非表示のお店がない）" },
  { id: "pins", when: "前日まで", text: "地図のピン（お店の場所・トイレ・受付）を本物の場所に置いた" },
  { id: "radio", when: "前日まで", text: "校内ラジオの番組表を入れた" },
  { id: "backup", when: "前日まで", text: "データの控えを保存した（当日の道具）" },
  { id: "survey-clear", when: "前日まで", text: "アンケートの試しの回答を消した" },
  { id: "reset", when: "当日の朝", text: "売り切れと状態をまとめて戻した" },
  { id: "news-clear", when: "当日の朝", text: "古いお知らせを消した" },
  { id: "phase", when: "当日の朝", text: "表示の時期が「日時で自動」になっている" },
  { id: "open", when: "当日の朝", text: "10:00 に全部のお店を「営業中」にした" },
  { id: "close", when: "終わったら", text: "全部のお店を「終了」にした" },
  { id: "award", when: "終わったら", text: "夢中アワードを発表した" },
  { id: "survey-close", when: "終わったら", text: "アンケートの受付を止める日を決めた" },
  { id: "backup-after", when: "終わったら", text: "データの控えと、アンケートの表（CSV）を保存した" },
];
export const checkBody = z.object({ id: z.string().max(40), done: z.boolean() });

/* ───── 従業員側の画面が 15 秒ごとに読む「いまの様子」（GET /api/staff/live） ───── */
export type StaffLiveShop = { state: ShopState; notice: string; noticeAt?: number; stock: Record<string, Stock>; hidden: boolean; updatedAt: number };
/** 実行委員：全部のお店（非表示も）・呼び出し・お店の人への連絡と、読んだ印（お店 id → 読んだ連絡の id） */
export type AdminLive = { at: number; shops: Record<string, StaffLiveShop>; calls: Call[]; memo: Memo | null; acks: Record<string, string> };
/** お店の人：自分のお店・自分の呼び出し・お店の人への連絡（読んだかどうか） */
export type ShopLive = { at: number; shop: StaffLiveShop | null; calls: Call[]; memo: Memo | null; acked: boolean };
