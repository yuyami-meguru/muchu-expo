import "server-only";
import { AWARD_KEY, parseAward } from "@/app/(public)/award/award-data";
import { parseRadio, radioLive } from "./radio";
import { getSetting, getSettings, readHash, readHashOne } from "./store";
import { parseAlert, parseCalls, parseMemo, parsePhaseMode, type Call } from "./ops";

/**
 * お客さん側に毎回配る運営の設定（全体の帯・表示の時期・アワードを発表したか・アンケートを受け付けているか・ラジオ）。
 * 15 秒ごとにみんなが読むので、設定はまとめて 1 回で読む（Upstash の無料枠を使いすぎないため）
 */
export async function loadPublicOps() {
  const [alert, phase, award, survey, radio] = await getSettings(["alert", "phase", AWARD_KEY, "surveyOpen", "radio"]);
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

/** 従業員側の「いまの様子」で読む設定（お店の人への連絡） */
export async function loadStaffOps() {
  const [memo] = await getSettings(["memo"]);
  return { memo: parseMemo(memo) };
}

/** そのお店が読んだ連絡の id */
export async function loadMemoAck(shop: string) {
  return readHashOne("memo-ack", shop);
}

/** 呼び出し。済んでから 2 時間たったもの・2 日より前のものは出さない */
export async function loadCalls(shop?: string): Promise<Call[]> {
  const now = Date.now();
  return parseCalls(await readHash("call")).filter(
    (c) => (!shop || c.shop === shop) && now - c.at < 48 * 3600_000 && !(c.status === "done" && now - c.updatedAt > 2 * 3600_000),
  );
}

export async function loadMemoAcks() {
  return readHash("memo-ack");
}

export async function loadChecks() {
  return readHash("check");
}
