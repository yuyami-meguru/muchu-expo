import "server-only";
import { cache } from "react";
import { parseAlert, parseMemo, readPhaseSetting } from "@/lib/ops";
import { parseRadio } from "@/lib/radio";
import { getSettings } from "@/lib/store";

/** いまの時刻（サーバー。表示のたびに 1 回だけ読む）。表示の時期・ログインの残りを決めるのに使う */
export const serverNow = () => Date.now();

/**
 * 実行委員の画面で使う運営の設定（全体の帯・表示の時期・ラジオ・お店の人への連絡）。
 * 枠（layout.tsx の上の帯）と、いまの様子・当日の道具が同じ表示の中で読んでも、まとめて 1 回だけ読む（Upstash の回数を増やさない）。
 * 表示の時期は、手で変えた時期が「日時で自動」に戻る時刻（phaseUntil。その日の 24:00）も返す
 */
export const loadAdminOps = cache(async () => {
  const [alert, phase, radio, memo] = await getSettings(["alert", "phase", "radio", "memo"]);
  const p = readPhaseSetting(phase, serverNow());
  return { alert: parseAlert(alert), phase: p.mode, phaseUntil: p.until, radio: parseRadio(radio), memo: parseMemo(memo) };
});
