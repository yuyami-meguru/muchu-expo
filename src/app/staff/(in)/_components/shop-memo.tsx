"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { Memo } from "@/lib/ops";
import { send } from "../../_lib/client";
import { failText, stamp } from "./shop-result";

/** 実行委員からの連絡の［見ました］（上の帯から開く小窓と、いちばん下のカードで同じものを使う） */
export type MemoAck = {
  memo: Memo | null;
  /** 見ました（届いた） */
  done: boolean;
  pending: boolean;
  /** 返事が来なかったので、届いたか確かめている */
  checking: boolean;
  error: string;
  ack: () => void;
};

/**
 * ［見ました］を送る。返事が来なかったときは「いまの様子」を読み直して、見ましたの印（acked）が付いたかで決める。
 * ログインが切れていたら onExpired（画面の上に入り直し方を出す）
 */
export function useMemoAck(memo: Memo | null, acked: boolean, liveAt: number, refresh: () => Promise<void>, onExpired: () => void): MemoAck {
  // この画面で［見ました］が届いた連絡の id（「いまの様子」に入るまでのあいだも「✓ 見ました」にする）
  const [seen, setSeen] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  // 確かめている連絡と、確かめ始めたときの「いまの様子」の時刻（サーバー）
  const [check, setCheck] = useState<{ id: string; seenAt: number; done: boolean } | null>(null);
  const liveAtRef = useRef(liveAt);
  useEffect(() => {
    liveAtRef.current = liveAt;
  });

  const id = memo?.id ?? "";
  const done = !!memo && (acked || seen === id);
  // 確かめるための読み直し（使い回しなし）が終わってから決める（ふだんの読み直しは古い中身のことがある）
  const mine = check && check.id === id && !done ? check : null;
  const checking = !!mine && !mine.done;
  const shown = mine
    ? !mine.done
      ? ""
      : liveAt > mine.seenAt
        ? "「見ました」が届いていませんでした。もう一度押してください"
        : "「見ました」が届いたか確かめられませんでした（電波が届いていません）。もう一度押してください"
    : error;

  async function ack() {
    if (!memo || pending) return;
    setPending(true);
    setError("");
    setCheck(null);
    const r = await send("/api/staff/memo/ack", "POST", { id: memo.id });
    setPending(false);
    if (r.ok) return setSeen(memo.id);
    if (r.unsure) {
      const c = { id: memo.id, seenAt: liveAtRef.current, done: false };
      setCheck(c);
      await refresh();
      setCheck((x) => (x === c ? { ...c, done: true } : x));
      return;
    }
    if (r.status === 401) {
      onExpired();
      return setError("ログインが切れました。お店の QR をもう一度読み取ってください");
    }
    setError(failText("「見ました」を送れませんでした", r.error));
  }

  return { memo, done, pending, checking, error: done ? "" : shown, ack };
}

/** ［見ました］（確かめているあいだは押しても何もしない。disabled にしないのは、フォーカスが外れないように） */
function AckButton({ m, primary }: { m: MemoAck; primary: boolean }) {
  return (
    <Button variant={primary ? "primary" : "secondary"} pending={m.pending} aria-disabled={m.checking || undefined} onClick={() => !m.checking && m.ack()}>
      見ました
    </Button>
  );
}

/** ［見ました］の結果（確かめ中・まちがい） */
function AckNote({ m }: { m: MemoAck }) {
  return (
    <>
      {m.checking && (
        <p className="sh-memo-wait" role="status">
          返事が来ません。届いたか確かめています…
        </p>
      )}
      {m.error && (
        <p className="st-err" role="alert">
          {m.error}
        </p>
      )}
    </>
  );
}

/**
 * 実行委員からの連絡（全部のお店へ。お客さんには見えない）を、ページのいちばん下にカードで出す（読み返す所）。
 * 新しい連絡は、画面の上に重ねる帯（ShopAlert）で知らせる。ここ（いちばん下）に足しても、上の売り切れのボタンはずれない
 */
export function ShopMemo({ m, today }: { m: MemoAck; today: number | null }) {
  const { memo, done } = m;
  if (!memo) return null;
  return (
    <section className={done ? "sh-memo" : "sh-memo sh-memo--new"} aria-labelledby="sh-memo-h">
      <p className="sh-memo-head">
        <strong id="sh-memo-h">実行委員からの連絡</strong>
        <time dateTime={new Date(memo.at).toISOString()}>{stamp(memo.at, today)}</time>
        {!done && <span className="sh-memo-badge">まだ見ていません</span>}
      </p>
      <p className="sh-memo-text">{memo.text}</p>
      {done ? (
        <p className="sh-memo-done">✓ 見ました</p>
      ) : (
        <>
          <AckButton m={m} primary={false} />
          <AckNote m={m} />
        </>
      )}
    </section>
  );
}

/**
 * 上の帯の［見る］で開く小窓。連絡の全文と［見ました］［とじる］。見ましたが届いたら閉じる（帯も消える）。
 * 見た目は確認の小窓（ConfirmDialog）と同じ ui-dialog（スマホは下から出る）
 */
export function MemoDialog({ m, open, onClose, today }: { m: MemoAck; open: boolean; onClose: () => void; today: number | null }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  // 見ましたが届いた・連絡が取り消された：閉じる
  useEffect(() => {
    if (open && (m.done || !m.memo)) onClose();
  }, [open, m.done, m.memo, onClose]);

  return (
    <dialog
      ref={ref}
      className="ui-dialog sh-memo-dialog"
      aria-labelledby="sh-memo-dlg-h"
      onClose={onClose}
      onClick={(e) => {
        // うしろ（小窓の外）を押したら閉じる
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="ui-dialog-inner">
        <span className="ui-dialog-grip" aria-hidden="true" />
        <div className="ui-dialog-head">
          <h2 className="ui-dialog-title" id="sh-memo-dlg-h">
            実行委員からの連絡{m.memo ? `（${stamp(m.memo.at, today)}）` : ""}
          </h2>
        </div>
        <div className="ui-dialog-body">
          <p className="sh-memo-text">{m.memo?.text}</p>
          <p className="st-muted">お客さんには見えません。読んだら［見ました］を押してください（読んだことが実行委員に伝わります）。</p>
        </div>
        <AckNote m={m} />
        <div className="ui-dialog-actions">
          <Button variant="secondary" onClick={onClose}>
            とじる
          </Button>
          <AckButton m={m} primary />
        </div>
      </div>
    </dialog>
  );
}
