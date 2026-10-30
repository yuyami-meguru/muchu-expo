"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition } from "react";
import { Icon } from "@/components/icons";
import { Button, buttonClass } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { send } from "../../_lib/client";
import { noteAuth } from "../_components/session-signal";
import { clockNow } from "../ops-live";
import { failMsg } from "../ops-result";

/**
 * 受付のオン・オフ、表（CSV）で保存、回答を全部消す。
 * before（開催前）：受付をオンにしていても、お客さんは答えられない（サーバーが 11/28 の当日まで断る）ことを出す
 */
export function SurveyTools({ open, total, ready, before }: { open: boolean; total: number; ready: boolean; before: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function toggle() {
    setBusy(true);
    const r = noteAuth(await send("/api/staff/survey", "PUT", { open: !open }));
    setBusy(false);
    setMsg(r.ok ? `${open ? "受付を止めました" : "受付を始めました"}（${clockNow()}）` : failMsg(open ? "受付を止めることが" : "受付を始めることが", r, "この画面を読み込み直して確かめてください"));
    router.refresh();
  }

  async function clearAll() {
    setBusy(true);
    const r = noteAuth(await send("/api/staff/survey", "DELETE", { confirm: "消す" }));
    setBusy(false);
    setMsg(r.ok ? `回答を全部消しました（${clockNow()}）` : failMsg("回答を全部消すことが", r, "この画面を読み込み直して、回答の数を確かめてください"));
    router.refresh();
  }

  return (
    <div className="sr-tools">
      <p className="sr-state">
        受付：<strong className={open ? "sr-on" : "sr-off"}>{open ? "受け付けています" : "止めています"}</strong>
        {before && open && <span className="sr-before">（いまは開催前なので、お客さんは答えられません。11/28 の当日から受け付けます）</span>}
      </p>
      <div className="sr-tool-row">
        <Button onClick={toggle} pending={busy} disabled={!ready} variant={open ? "secondary" : "primary"}>
          {open ? "受付を止める" : "受付を始める"}
        </Button>
        {/* ファイルを受け取るので、ページの移動（next/link）ではなくふつうのリンクにする */}
        <a href="/api/staff/survey" download className={buttonClass({ variant: "secondary" })}>
          表（CSV）で保存
        </a>
        <ClearAllDialog total={total} disabled={!ready || total === 0 || busy} onConfirm={clearAll} />
      </div>
      {!ready && <p className="sr-sub">保存先（Upstash）がつながっていないので、変えられません</p>}
      <p className="sr-sub" role="status" aria-live="polite">
        {msg}
      </p>
    </div>
  );
}

/**
 * 回答を全部消す前の確認の小窓。「消す」と打つまで、消すボタンは押せない。
 * 形と見た目は ConfirmDialog（components/ui/confirm-dialog.tsx）と同じ（ui-dialog）。Esc・うしろを押すと閉じる（何もしない）
 */
function ClearAllDialog({ total, disabled, onConfirm }: { total: number; disabled: boolean; onConfirm: () => Promise<void> }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [word, setWord] = useState("");
  const [pending, startTransition] = useTransition();
  const ok = word.trim() === "消す";
  const close = () => ref.current?.close();
  return (
    <>
      <Button
        variant="danger"
        icon="消す"
        disabled={disabled}
        aria-haspopup="dialog"
        onClick={() => {
          setWord("");
          ref.current?.showModal();
        }}
      >
        回答を全部消す
      </Button>
      <dialog
        ref={ref}
        className="ui-dialog"
        aria-labelledby={titleId}
        onClose={() => setWord("")}
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
      >
        <div className="ui-dialog-inner">
          <span className="ui-dialog-grip" aria-hidden="true" />
          <div className="ui-dialog-head">
            <span className="ui-dialog-mark" aria-hidden="true">
              <Icon name="注意" size={20} />
            </span>
            <h2 className="ui-dialog-title" id={titleId}>
              回答 {total} 件を全部消しますか？
            </h2>
          </div>
          <div className="ui-dialog-body">
            <p>消すと元に戻せません。先に［表（CSV）で保存］をしてください。</p>
            <TextField
              label="消すときは「消す」と打ってください"
              value={word}
              autoComplete="off"
              enterKeyHint="done"
              onChange={(e) => setWord(e.target.value)}
              hint={ok ? "下の「全部消す」を押せます" : "打つまで「全部消す」は押せません"}
            />
          </div>
          <div className="ui-dialog-actions">
            <Button variant="secondary" onClick={close} autoFocus disabled={pending}>
              やめる
            </Button>
            <Button
              variant="danger"
              disabled={!ok}
              pending={pending}
              onClick={() =>
                startTransition(async () => {
                  await onConfirm();
                  close();
                })
              }
            >
              全部消す
            </Button>
          </div>
        </div>
      </dialog>
    </>
  );
}
