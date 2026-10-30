"use client";

import Link from "next/link";
import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { TextArea } from "@/components/ui/field";
import { ALERT_LEVELS, type AlertLevel, type SiteAlert } from "@/lib/ops";
import { clock, send } from "../../_lib/client";
import { noteAuth } from "../_components/session-signal";
import { failMsg, REACH, ResultLine, type Result } from "../ops-result";
import type { MarkDirty } from "./news-board";

const levelLabel = (l: AlertLevel) => ALERT_LEVELS.find((x) => x.value === l)?.label ?? l;
const presetOf = (l: AlertLevel) => ALERT_LEVELS.find((x) => x.value === l)?.preset ?? "";
const isPreset = (t: string) => ALERT_LEVELS.some((x) => x.preset && x.preset === t);
/** 返事が来なかったとき */
const UNSURE_NEXT = "少しして上の「いま：」が読み直されたら、変わったか確かめてください";

/** 帯の見本（お客さん側のいちばん上に出る形） */
function AlertSample({ level, text }: { level: AlertLevel; text: string }) {
  return (
    <div className={`ops-alert ops-alert--${level}`}>
      <b>{level === "urgent" ? "急ぎ" : level === "rain" ? "雨" : "お知らせ"}</b>
      <span>{text || "（帯に出す文を入れてください）"}</span>
    </div>
  );
}

type Props = { alert: SiteAlert; setAlert: Dispatch<SetStateAction<SiteAlert>>; touch: () => void; ready: boolean; markDirty: MarkDirty };

/**
 * 全体の帯（雨・急ぎ）。種類を選ぶと文の例が入る（自分で書いた文は消さない）。文は直せる。
 * お客さん側の全部のページのいちばん上に出る（当日は 20 秒ほどで）。
 * 雨を選んだときは、帯を出してもお店の場所は変わらないこと（先に場所を直すこと）を出す。
 */
export function AlertCard({ alert, setAlert, touch, ready, markDirty }: Props) {
  /** 書きかけ（null なら、いまの帯と同じ。ほかの実行委員が変えた分も入る） */
  const [draft, setDraft] = useState<{ level: AlertLevel; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result>(null);
  const [showOpen, setShowOpen] = useState(false);
  const [hideOpen, setHideOpen] = useState(false);
  const form = draft ?? { level: alert.level, text: alert.text };
  // いま出ている帯とちがう文・種類を書きかけていたら、ほかの画面へ移る前に聞く
  const dirty = !!draft && (draft.text.trim() !== alert.text.trim() || (draft.level !== alert.level && !!draft.text.trim()));
  useEffect(() => {
    markDirty("alert", dirty);
  }, [dirty, markDirty]);

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
    const r = noteAuth(await send<{ alert: SiteAlert }>("/api/staff/alert", "PUT", body));
    setBusy(false);
    if (!r.ok) return setResult({ text: failMsg(on ? "帯を出すことが" : "帯を消すことが", r, UNSURE_NEXT), error: true });
    touch();
    setAlert(r.alert);
    setDraft(null);
    setResult({ text: on ? `帯を出しました（${clock(r.alert.at)}）。${REACH}` : `帯を消しました（${clock(r.alert.at)}）。当日は 20 秒ほどで、お客さんの画面から消えます（開催前は、数分かかることがあります）` });
  }

  return (
    <Card title="全体の帯（雨・急ぎ）" id="alert">
      <p className="st-muted">お客さん側の全部のページのいちばん上に出ます。雨で場所が変わったときや、急ぎの案内に使います。{REACH}。</p>
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
      {form.level === "rain" && (
        <p className="ops-note">
          帯を出しても、お店のページ・地図の場所は変わりません。雨で外のお店が場所を移るときは、先に
          <Link href="/staff/places#shop-places">「お店の場所を決める」</Link>
          でそのお店の場所を直してから、帯を出してください。決まっていないことは、帯に書かないでください。
        </p>
      )}
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
        <p style={{ marginTop: 8 }}>お客さん側の全部のページのいちばん上に出ます。{REACH}。</p>
      </ConfirmDialog>
      <ConfirmDialog title="全体の帯を消しますか？" confirmLabel="帯を消す" open={hideOpen} onOpenChange={setHideOpen} onConfirm={() => put(false)}>
        お客さんの画面から消えます（当日は 20 秒ほどで）。文は残るので、あとでまた出せます。
      </ConfirmDialog>
    </Card>
  );
}
