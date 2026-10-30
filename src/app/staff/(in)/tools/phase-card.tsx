"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PHASE_MODES, phaseOf, type Phase, type PhaseMode } from "@/lib/ops";
import { send } from "../../_lib/client";
import { clockNow } from "../ops-live";
import { ResultLine, type Result } from "../ops-result";

/** お客さんの画面の出し方（phaseOf の答え） */
const PHASE_LABEL: Record<Phase, string> = { before: "開催前", morning: "当日の朝（10:00 まで）", during: "開催中", after: "終了後" };
const modeLabel = (m: PhaseMode) => PHASE_MODES.find((x) => x.value === m)?.label ?? m;

type Now = { mode: PhaseMode; now: Phase };

/**
 * 表示の時期（日時で自動・開催前・当日・終了後）。ふだんは「日時で自動」。前日の練習のときだけ「当日」にして、終わったら戻す。
 * 選んでから［この時期にする］で切り替える（お客さんの画面がすぐ変わるので、押しまちがえないように 2 段で）。
 */
export function PhaseCard({ ready, phase }: { ready: boolean; phase: Now }) {
  const router = useRouter();
  /** 自分が切り替えた値（読み直しが届くまで出す） */
  const [saved, setSaved] = useState<Now | null>(null);
  /** 選んだけれど、まだ切り替えていない値 */
  const [pick, setPick] = useState<PhaseMode | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result>(null);
  const [seen, setSeen] = useState(phase);
  if (seen !== phase) {
    // 読み直した値が届いたら、それを使う（ほかの実行委員が変えた分も入る）
    setSeen(phase);
    if (!busy) setSaved(null);
  }
  const cur = saved ?? phase;
  const chosen = pick ?? cur.mode;

  async function save() {
    const mode = chosen;
    setBusy(true);
    setResult(null);
    const r = await send("/api/staff/phase", "PUT", { mode });
    setBusy(false);
    if (!r.ok) return setResult({ text: r.error, error: true });
    setSaved({ mode, now: phaseOf(Date.now(), mode) });
    setPick(null);
    setResult({ text: `表示の時期を「${modeLabel(mode)}」にしました（${clockNow()}）` });
    router.refresh();
  }

  return (
    <Card title="表示の時期">
      <p className="st-phase-now">
        いま：<strong>{modeLabel(cur.mode)}</strong>（お客さんの画面は「{PHASE_LABEL[cur.now]}」の出し方）
      </p>
      {cur.mode !== "auto" && <p className="ops-warn">練習が終わったら「日時で自動」に戻してください。</p>}
      <fieldset className="st-phase" disabled={!ready || busy}>
        <legend className="sr-only">表示の時期を選ぶ</legend>
        {PHASE_MODES.map((m) => (
          <label key={m.value} className="st-phase-opt">
            <input type="radio" name="phase-mode" value={m.value} checked={chosen === m.value} onChange={() => setPick(m.value)} />
            <span className="st-phase-text">
              <b>
                {m.label}
                {m.value === cur.mode && <span className="st-phase-tag">いまこれ</span>}
              </b>
              <small>{m.hint}</small>
            </span>
          </label>
        ))}
      </fieldset>
      <div className="st-row" style={{ marginTop: 12 }}>
        {chosen === cur.mode ? (
          <p className="st-muted">切り替えるときは、上から選ぶとボタンが出ます。</p>
        ) : (
          <Button variant="secondary" disabled={!ready} pending={busy} onClick={save}>
            「{modeLabel(chosen)}」にする
          </Button>
        )}
      </div>
      <ResultLine r={result} />
    </Card>
  );
}
