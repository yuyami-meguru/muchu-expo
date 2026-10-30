"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { TextArea } from "@/components/ui/field";
import { ALERT_LEVELS, type AlertLevel, type SiteAlert } from "@/lib/ops";
import { clock, send } from "../../_lib/client";
import { ResultLine, type Result } from "../ops-result";

const levelLabel = (l: AlertLevel) => ALERT_LEVELS.find((x) => x.value === l)?.label ?? l;
const presetOf = (l: AlertLevel) => ALERT_LEVELS.find((x) => x.value === l)?.preset ?? "";
const isPreset = (t: string) => ALERT_LEVELS.some((x) => x.preset && x.preset === t);

/** 帯の見本（お客さん側のいちばん上に出る形） */
function AlertSample({ level, text }: { level: AlertLevel; text: string }) {
  return (
    <div className={`ops-alert ops-alert--${level}`}>
      <b>{level === "urgent" ? "急ぎ" : level === "rain" ? "雨" : "お知らせ"}</b>
      <span>{text || "（帯に出す文を入れてください）"}</span>
    </div>
  );
}

type Props = { alert: SiteAlert; setAlert: Dispatch<SetStateAction<SiteAlert>>; touch: () => void; ready: boolean };

/**
 * 全体の帯（雨・急ぎ）。種類を選ぶと文の例が入る（自分で書いた文は消さない）。文は直せる。
 * お客さん側の全部のページのいちばん上に、20 秒ほどで出る。
 */
export function AlertCard({ alert, setAlert, touch, ready }: Props) {
  /** 書きかけ（null なら、いまの帯と同じ。ほかの実行委員が変えた分も入る） */
  const [draft, setDraft] = useState<{ level: AlertLevel; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result>(null);
  const [showOpen, setShowOpen] = useState(false);
  const [hideOpen, setHideOpen] = useState(false);
  const form = draft ?? { level: alert.level, text: alert.text };

  function pickLevel(level: AlertLevel) {
    // 文が空か、ほかの種類の例のままなら、選んだ種類の例を入れる
    const t = form.text.trim();
    setDraft({ level, text: !t || isPreset(t) ? presetOf(level) : form.text });
  }

  async function put(on: boolean) {
    setBusy(true);
    setResult(null);
    touch();
    const body = on ? { on, level: form.level, text: form.text.trim() } : { on, level: alert.level, text: alert.text };
    const r = await send<{ alert: SiteAlert }>("/api/staff/alert", "PUT", body);
    setBusy(false);
    if (!r.ok) return setResult({ text: r.error, error: true });
    touch();
    setAlert(r.alert);
    setDraft(null);
    setResult({ text: on ? `帯を出しました（${clock(r.alert.at)}）。お客さんの画面には 20 秒ほどで出ます` : `帯を消しました（${clock(r.alert.at)}）。20 秒ほどで消えます` });
  }

  return (
    <Card title="全体の帯（雨・急ぎ）" id="alert">
      <p className="st-muted">お客さん側の全部のページのいちばん上に、20 秒ほどで出ます。雨で場所が変わったときや、急ぎの案内に使います。</p>
      <div className={alert.on ? "ops-alert-now ops-alert-now--on" : "ops-alert-now"}>
        {alert.on ? (
          <>
            <p className="ops-alert-state">
              いま：出ています（{levelLabel(alert.level)}・{clock(alert.at)} から）
            </p>
            <AlertSample level={alert.level} text={alert.text} />
          </>
        ) : (
          <p className="ops-alert-state">いま：出していません</p>
        )}
      </div>

      <fieldset className="ops-levels" disabled={!ready || busy}>
        <legend className="ui-label">種類（選ぶと文の例が入ります）</legend>
        {ALERT_LEVELS.map((l) => (
          <label key={l.value} className={`ops-level ops-level--${l.value}`}>
            <input type="radio" name="alert-level" value={l.value} checked={form.level === l.value} onChange={() => pickLevel(l.value)} />
            <span>{l.label}</span>
          </label>
        ))}
      </fieldset>
      <TextArea
        label="帯に出す文"
        value={form.text}
        maxLength={140}
        rows={3}
        onChange={(e) => setDraft({ level: form.level, text: e.target.value })}
        hint={`${form.text.length}/140 字`}
      />
      {presetOf(form.level) && form.text.trim() !== presetOf(form.level) && (
        <p className="ops-preset">
          <span>例：{presetOf(form.level)}</span>
          <Button size="sm" variant="ghost" disabled={!ready || busy} onClick={() => setDraft({ level: form.level, text: presetOf(form.level) })}>
            例の文を入れる
          </Button>
        </p>
      )}
      <p className="ops-sample-k">見本</p>
      <AlertSample level={form.level} text={form.text.trim()} />
      <div className="ops-news-btns" style={{ marginTop: 12 }}>
        <Button variant={form.level === "urgent" ? "danger" : "secondary"} disabled={!ready || !form.text.trim()} pending={busy} onClick={() => setShowOpen(true)} aria-haspopup="dialog">
          {alert.on ? "この文で出し直す" : "帯を出す"}
        </Button>
        {alert.on && (
          <Button variant="danger" icon="消す" disabled={!ready || busy} onClick={() => setHideOpen(true)} aria-haspopup="dialog">
            帯を消す
          </Button>
        )}
        {draft && (
          <Button variant="ghost" disabled={busy} onClick={() => setDraft(null)}>
            書きかけをやめる
          </Button>
        )}
      </div>
      <ResultLine r={result} />

      <ConfirmDialog title="全体の帯を出しますか？" confirmLabel="帯を出す" tone="primary" open={showOpen} onOpenChange={setShowOpen} onConfirm={() => put(true)}>
        <AlertSample level={form.level} text={form.text.trim()} />
        <p style={{ marginTop: 8 }}>お客さん側の全部のページのいちばん上に、20 秒ほどで出ます。</p>
      </ConfirmDialog>
      <ConfirmDialog title="全体の帯を消しますか？" confirmLabel="帯を消す" open={hideOpen} onOpenChange={setHideOpen} onConfirm={() => put(false)}>
        お客さんの画面から、20 秒ほどで消えます。文は残るので、あとでまた出せます。
      </ConfirmDialog>
    </Card>
  );
}
