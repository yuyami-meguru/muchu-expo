import "server-only";
import { AWARD_KEY, parseAward } from "@/app/(public)/award/award-data";
import { parseRadio, radioLive } from "./radio";
import { getSetting, getSettings, readHash, readHashOne, type ReadOpts } from "./store";
import { parseAlert, parseMemo, parsePhaseMode } from "./ops";

/**
 * お客さん側に毎回配る運営の設定（全体の帯・表示の時期・アワードを発表したか・アンケートを受け付けているか・ラジオ）。
 * 15 秒ごとにみんなが読むので、設定はまとめて 1 回で読む（Upstash の無料枠を使いすぎないため）。
 * お客さん側では、同じサーバーの中で表示の時期に合わせて使い回す（store.ts の「読みの使い回し」。/api/status は opts.read で決める）
 */
export async function loadPublicOps(opts: ReadOpts = {}) {
  const [alert, phase, award, survey, radio] = await getSettings(["alert", "phase", AWARD_KEY, "surveyOpen", "radio"], opts);
  const a = parseAward(award);
  return {
    ops: {
      alert: parseAlert(alert),
      phase: parsePhaseMode(phase),
      awardOn: a.published && a.awards.some((x) => x.winners.length > 0),
      surveyOpen: survey !== "0",
    },
    radio: radioLive(parseRadio(radio)),
  };
}

export async function loadMemo() {
  return parseMemo(await getSetting("memo"));
}

/**
 * 従業員側の「いまの様子」で読む設定（お店の人への連絡・表示の時期・全体の帯・ラジオ）。まとめて 1 回で読む。
 * 15 秒ごとの読み直しでは opts.read（STAFF_POLL_READ）で少しだけ使い回す
 */
export async function loadStaffOps(opts: ReadOpts = {}) {
  const [memo, phase, alert, radio] = await getSettings(["memo", "phase", "alert", "radio"], opts);
  return { memo: parseMemo(memo), phase: parsePhaseMode(phase), alert: parseAlert(alert), radio: radioLive(parseRadio(radio)) };
}

/** そのお店が読んだ連絡の id。maxAge（ミリ秒）を渡すと、全部のお店の印をまとめて読んで使い回す */
export async function loadMemoAck(shop: string, opts: { maxAge?: number } = {}) {
  if (opts.maxAge) return (await readHash("memo-ack", opts))[shop] ?? null;
  return readHashOne("memo-ack", shop);
}

export async function loadMemoAcks(opts: { maxAge?: number } = {}) {
  return readHash("memo-ack", opts);
}

export async function loadChecks() {
  return readHash("check");
}
