"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { CALL_REASONS, type Call, type CallReason } from "@/lib/ops";
import { clock, send } from "../../_lib/client";
import { failText, nowClock, without } from "./shop-result";

/**
 * 実行委員を呼ぶ（お店の画面のいちばん上近く）。理由を大きなボタンで選び、ひとことを書いて［呼ぶ］。
 * 呼んだあとは「呼びました…」、実行委員が向かい始めたら「実行委員が向かっています」。［解決した・取り消す］で済みにする。
 * calls は「いまの様子」の呼び出し（このお店の分だけ）、at はその様子を読んだ時刻（まだ読んでいなければ 0）。
 */
export function ShopCalls({ calls, at, refresh }: { calls: Call[]; at: number; refresh: () => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<CallReason | null>(null);
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  // 呼んだばかりで、まだ「いまの様子」に入っていない呼び出し
  const [mine, setMine] = useState<Call[]>([]);
  // ［解決した・取り消す］の途中（sending）・済ませた（done）もの
  const [closing, setClosing] = useState<Record<string, "sending" | "done">>({});
  const [itemError, setItemError] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");

  // 呼んだあとに読んだ「いまの様子」があれば、そちらだけを使う（済んでしばらくたつと様子から消えるので、手元の古い分は出さない）
  const known = new Set(calls.map((c) => c.id));
  const list = [...calls, ...mine.filter((c) => !known.has(c.id) && c.at > at)]
    .filter((c) => c.status !== "done" && closing[c.id] !== "done")
    .sort((a, b) => b.at - a.at);

  function close() {
    setOpen(false);
    setError("");
  }

  async function call() {
    if (!reason) return setError("どうしたかを、上のボタンから選んでください");
    setPending(true);
    setError("");
    setMsg("");
    const r = await send<{ call: Call }>("/api/staff/calls", "POST", { reason, text });
    setPending(false);
    if (!r.ok) return setError(failText("呼べませんでした", r.error, "もう一度［呼ぶ］を押してください"));
    setMine((l) => [r.call, ...l]);
    setOpen(false);
    setReason(null);
    setText("");
    refresh();
  }

  async function finish(c: Call) {
    setClosing((m) => ({ ...m, [c.id]: "sending" }));
    setItemError((m) => without(m, c.id));
    setMsg("");
    const r = await send(`/api/staff/calls/${c.id}`, "PATCH", { status: "done" });
    if (!r.ok) {
      setClosing((m) => without(m, c.id));
      setItemError((m) => ({ ...m, [c.id]: failText("済みにできませんでした", r.error) }));
      return;
    }
    setClosing((m) => ({ ...m, [c.id]: "done" }));
    setMsg(`✓ 呼び出し（${c.reason}）を済みにしました ${nowClock()}`);
    refresh();
  }

  return (
    <section className="sh-call" aria-labelledby="sh-call-h">
      <h2 id="sh-call-h" className="sr-only">
        実行委員を呼ぶ
      </h2>
      <Button size="lg" block icon="人" aria-expanded={open} aria-controls={open ? "sh-call-box" : undefined} onClick={() => (open ? close() : setOpen(true))}>
        実行委員を呼ぶ
      </Button>
      {open && (
        <div className="sh-call-box" id="sh-call-box">
          <p className="sh-call-q" id="sh-call-q">
            どうしましたか？
          </p>
          <div className="sh-reasons" role="group" aria-labelledby="sh-call-q">
            {CALL_REASONS.map((x) => (
              <button
                key={x}
                type="button"
                className="sh-reason"
                aria-pressed={reason === x}
                onClick={() => {
                  setReason(x);
                  setError("");
                }}
              >
                {reason === x && <span aria-hidden="true">✓ </span>}
                {x}
              </button>
            ))}
          </div>
          <TextField
            label="ひとこと"
            optional
            hint={`名前は書かないでください（${text.length}/80 字）`}
            value={text}
            maxLength={80}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="st-row sh-call-actions">
            <Button variant="primary" size="lg" pending={pending} onClick={call}>
              呼ぶ
            </Button>
            <Button variant="ghost" disabled={pending} onClick={close}>
              やめる
            </Button>
          </div>
          {error && (
            <p className="st-err" role="alert">
              {error}
            </p>
          )}
        </div>
      )}

      {list.length > 0 && (
        <ul className="sh-calls" aria-label="呼び出し中">
          {list.map((c) => (
            <li key={c.id} className="sh-callitem" data-status={c.status}>
              <p className="sh-callitem-head">
                <strong>{c.reason}</strong>
                <span>{clock(c.at)} に呼びました</span>
              </p>
              {c.text && <p className="sh-callitem-text">{c.text}</p>}
              <p className="sh-callitem-status" role="status">
                {c.status === "going" ? "実行委員が向かっています" : "呼びました。実行委員が向かうまで少しお待ちください"}
              </p>
              <Button size="sm" pending={closing[c.id] === "sending"} onClick={() => finish(c)}>
                解決した・取り消す
              </Button>
              {itemError[c.id] && (
                <p className="st-err" role="alert">
                  {itemError[c.id]}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
      {msg && (
        <p className="st-saved" role="status">
          {msg}
        </p>
      )}
    </section>
  );
}
