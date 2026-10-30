import { z } from "zod";
import type { ShopState, Stock } from "./types";

/*
 * 当日の運営の道具（画面とサーバーの両方で使う。server-only の物は入れない）。
 *  - 全体の帯：雨・急ぎの知らせを、お客さん側の全部のページのいちばん上に出す（setting "alert"）
 *  - 表示の時期：開催前・当日・終了後でホームの出し方を変える。ふだんは日時で自動、練習のときは実行委員が切り替える（setting "phase"）
 *  - お店の人への連絡：実行委員 → 全部のお店（お客さんには見えない。setting "memo"、読んだ印はハッシュ muchu:memo-ack）
 *  - 当日のチェックリスト（ハッシュ muchu:check）
 */

/* ───── 開催の時刻（日本時間） ───── */
export const DAY_START = Date.parse("2026-11-28T00:00:00+09:00");
export const OPEN_AT = Date.parse("2026-11-28T10:00:00+09:00");
export const CLOSE_AT = Date.parse("2026-11-28T14:00:00+09:00");
/** 開催日の次の日の 0:00（ここから先は「終了後」の中でも、もう当日ではない） */
export const DAY_END = Date.parse("2026-11-29T00:00:00+09:00");

/** before＝開催日より前、morning＝当日の 10:00 まで、during＝10:00〜14:00、after＝14:00 から */
export type Phase = "before" | "morning" | "during" | "after";
export type PhaseMode = "auto" | "before" | "during" | "after";
export const PHASE_MODES: { value: PhaseMode; label: string; hint: string }[] = [
  { value: "auto", label: "日時で自動", hint: "ふだんはこれ。11/28 は 0:00 から「当日の朝」、10:00 から「開催中」、14:00 から「終了後」に変わります" },
  { value: "before", label: "開催前", hint: "売り切れ・営業中の札を出さず、「当日 10:00 から出ます」と案内します。その日の 24:00 に「日時で自動」に戻ります" },
  {
    value: "during",
    label: "当日（開催中）",
    hint: "前日の練習のときに。売り切れ・営業中の札が出ます（このあいだは、だれが見ても当日の画面です）。その日の 24:00 に「日時で自動」に戻ります",
  },
  { value: "after", label: "終了後", hint: "「本日は終了しました」と出し、アンケートと受賞の発表を前に出します。その日の 24:00 に「日時で自動」に戻ります" },
];

export function phaseOf(now: number, mode: PhaseMode = "auto"): Phase {
  if (mode === "before" || mode === "after") return mode;
  if (mode === "during") return "during";
  if (now < DAY_START) return "before";
  if (now < OPEN_AT) return "morning";
  if (now < CLOSE_AT) return "during";
  return "after";
}

/*
 * 表示の時期の設定（setting "phase"）の保存の形。
 *  - v0.12.0 から：手で選んだ時期は「during|切り替えた時刻」。その日の 24:00（日本時間）を過ぎたら「日時で自動」として読む
 *    （練習のあとに戻し忘れても、次の日には自動に戻る）
 *  - それより前の「during」だけの形（時刻なし）も読める（自動に戻る時刻は分からないので、そのまま）
 */
export type PhaseSetting = {
  mode: PhaseMode;
  /** 手で切り替えた時刻（分からなければ 0） */
  at: number;
  /** 「日時で自動」に戻る時刻（自動のとき・分からないときは 0） */
  until: number;
};

const DAY_MS = 86400e3;
const JST_MS = 9 * 3600e3;
/** その日の 24:00（日本時間）の時刻 */
export function endOfDayJst(at: number) {
  return Math.floor((at + JST_MS) / DAY_MS) * DAY_MS + DAY_MS - JST_MS;
}

export function readPhaseSetting(raw: string | null | undefined, now = Date.now()): PhaseSetting {
  const [m, t] = (raw ?? "").split("|");
  const mode: PhaseMode = m === "before" || m === "during" || m === "after" ? m : "auto";
  const at = Number(t) || 0;
  if (mode === "auto" || !at) return { mode, at, until: 0 };
  const until = endOfDayJst(at);
  return now < until ? { mode, at, until } : { mode: "auto", at, until: 0 };
}

export function parsePhaseMode(raw: string | null | undefined, now = Date.now()): PhaseMode {
  return readPhaseSetting(raw, now).mode;
}

/** 保存する値（手で選んだ時期には、切り替えた時刻を付ける） */
export function phaseValue(mode: PhaseMode, at = Date.now()) {
  return mode === "auto" ? "auto" : `${mode}|${at}`;
}

/*
 * 「いまの様子」の読み直しの間隔と、使い回してよい古さ（表示の時期で変える。Upstash の無料枠を使いすぎないため）。
 *  - pollMs：お客さんの画面が /api/status を読み直す間隔
 *  - cdnSec・swrSec：/api/status を Vercel の CDN に置く秒数（s-maxage・stale-while-revalidate）
 *  - liveMs：サーバーの中（1 台の中）で、当日の値（売り切れ・状態・お知らせ）と運営の設定を使い回す古さ
 *  - contentMs：サーバーの中（1 台の中）で、お店の中身・部門・場所・フロアを使い回す古さ
 *    （Vercel の関数は何台かに分かれ、ほかの台で書いた分はこの古さだけ遅れて入るので、どれも 10 秒まで）
 * 開催中は、お店が押してから、お客さんの画面に出るまで長くて 20 秒ほど（15＋3＋3）。開催前・終了後は数分かかってもよい
 */
export type LiveTiming = { pollMs: number; cdnSec: number; swrSec: number; liveMs: number; contentMs: number };
export const LIVE_TIMING: Record<Phase, LiveTiming> = {
  before: { pollMs: 120_000, cdnSec: 60, swrSec: 30, liveMs: 10_000, contentMs: 10_000 },
  morning: { pollMs: 30_000, cdnSec: 10, swrSec: 10, liveMs: 10_000, contentMs: 10_000 },
  during: { pollMs: 15_000, cdnSec: 3, swrSec: 5, liveMs: 3_000, contentMs: 10_000 },
  after: { pollMs: 60_000, cdnSec: 30, swrSec: 15, liveMs: 10_000, contentMs: 10_000 },
};

/* ───── 全体の帯 ───── */
export type AlertLevel = "info" | "rain" | "urgent";
export type SiteAlert = { on: boolean; level: AlertLevel; text: string; at: number };
export const ALERT_LEVELS: { value: AlertLevel; label: string; preset: string }[] = [
  { value: "info", label: "ふつうのお知らせ（青）", preset: "" },
  // 雨の日の場所はまだ決まっていない（お店の場所も自動では変わらない）ので、決まったことだけを書く
  {
    value: "rain",
    label: "雨（黄）",
    preset: "雨のため、屋外のお店・出し物の場所が変わることがあります。くわしくは近くの係（生徒・先生）におたずねください。坂道では足元にお気をつけください。",
  },
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
  { id: "pins", when: "前日まで", text: "地図のピン（お店の場所・トイレ・受付）を正しい場所に置いた" },
  // 外の地図に建物のピンが無いと、お客さんが建物の中のフロアへ行く道が分からない（R7）
  { id: "outside-pins", when: "前日まで", text: "外の地図に、建物（知育館）・正門・受付のピンを正しい位置に置いた（建物のピンから中のフロアへ行ける）" },
  { id: "radio", when: "前日まで", text: "校内ラジオの番組表を入れた" },
  { id: "backup", when: "前日まで", text: "データの控えを保存した（当日の道具）" },
  { id: "survey-clear", when: "前日まで", text: "アンケートの試しの回答を消した" },
  // 練習のあと（前日）。［まとめて戻す］は売り切れ・状態・お店からのお知らせだけなので、ほかの 3 つも消す（まとめて戻すの「いっしょに消す」でもよい）
  {
    id: "practice-clean",
    when: "前日まで",
    text: "練習のあと：全体の帯・お店の人への連絡・ラジオの放送中を消し、表示の時期を「日時で自動」に戻した",
  },
  { id: "reset", when: "当日の朝", text: "売り切れと状態をまとめて戻した" },
  { id: "news-clear", when: "当日の朝", text: "試しに出したお知らせ・ラジオのメッセージを消した" },
  { id: "phase", when: "当日の朝", text: "表示の時期が「日時で自動」になっている" },
  // 点呼：機能は足さず、「お店の人への連絡」の［見ました］の数で、全部のお店のスマホが入れているかを確かめる
  { id: "rollcall", when: "当日の朝", text: "お店の人への連絡を出し、全部のお店が［見ました］を押した（入れていないお店のスマホがない）" },
  { id: "open", when: "当日の朝", text: "10:00 に全部のお店を「営業中」にした" },
  { id: "close", when: "終わったら", text: "全部のお店を「終了」にした" },
  { id: "award", when: "終わったら", text: "夢中アワードを発表した" },
  { id: "survey-close", when: "終わったら", text: "アンケートの受付を止める日を決めた" },
  { id: "backup-after", when: "終わったら", text: "データの控えと、アンケートの表（CSV）を保存した" },
];
export const checkBody = z.object({ id: z.string().max(40), done: z.boolean() });

/* ───── 従業員側の画面が 15 秒ごとに読む「いまの様子」（GET /api/staff/live） ───── */
export type StaffLiveShop = { state: ShopState; notice: string; noticeAt?: number; stock: Record<string, Stock>; hidden: boolean; updatedAt: number };
/**
 * 実行委員：全部のお店（非表示も）・お店の人への連絡と、読んだ印（お店 id → 読んだ連絡の id）。
 * v0.12.0 から、表示の時期の設定・全体の帯・ラジオの放送中も入る（同じ 1 回の読み込みで読む。古い答えには無い）
 */
export type AdminLive = {
  at: number;
  shops: Record<string, StaffLiveShop>;
  memo: Memo | null;
  acks: Record<string, string>;
  phase?: PhaseMode;
  alert?: SiteAlert;
  radio?: { onAir: boolean; now: string };
};
/**
 * お店の人：自分のお店・お店の人への連絡（読んだかどうか）・表示の時期の設定（phaseOf(at, phase) で決める。
 * 開催前だけ「お客さんに見せる準備」を開いて上に出し、当日は売り切れの操作の邪魔にならないよう、たたんで下へ）
 */
export type ShopLive = { at: number; shop: StaffLiveShop | null; memo: Memo | null; acked: boolean; phase: PhaseMode };
