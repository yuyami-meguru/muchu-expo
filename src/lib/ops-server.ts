import "server-only";
import { AWARD_KEY, parseAward } from "@/app/(public)/award/award-data";
import { getSetting, readHash, surveyOpen } from "./store";
import { parseAlert, parseCalls, parseMemo, parsePhaseMode, type Call } from "./ops";

/** お客さん側に毎回配る運営の設定（全体の帯・表示の時期・アワードを発表したか・アンケートを受け付けているか） */
export async function loadPublicOps() {
  const [alert, phase, award, survey] = await Promise.all([getSetting("alert"), getSetting("phase"), getSetting(AWARD_KEY), surveyOpen()]);
  const a = parseAward(award);
  return {
    alert: parseAlert(alert),
    phase: parsePhaseMode(phase),
    awardOn: a.published && a.awards.some((x) => x.winners.length > 0),
    surveyOpen: survey,
  };
}

export async function loadMemo() {
  return parseMemo(await getSetting("memo"));
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
