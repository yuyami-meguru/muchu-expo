"use client";

import { useState, type FormEvent } from "react";
import { MSG_KINDS, type MsgKind } from "@/lib/radio";

/** ラジオへのメッセージを送る欄 */
export function MessageForm() {
  const [kind, setKind] = useState<MsgKind>("メッセージ");
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [website, setWebsite] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(0);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!text.trim()) return setError("メッセージを書いてください");
    setSending(true);
    try {
      const r = await fetch("/api/radio/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, name, text, website }),
      });
      const j = (await r.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!r.ok || !j?.ok) throw new Error(j?.error ?? "送れませんでした。電波のよい所で、もう一度送ってください");
      setText("");
      setSent((n) => n + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "送れませんでした");
    } finally {
      setSending(false);
    }
  }

  return (
    <form className="rd-form" onSubmit={submit} noValidate>
      <fieldset className="rd-kinds">
        <legend>種類</legend>
        {MSG_KINDS.map((k) => (
          <label key={k} className="rd-kind">
            <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} />
            <span>{k}</span>
          </label>
        ))}
      </fieldset>
      <label className="rd-field">
        <span>ラジオネーム（なくてもよい・20 字まで）</span>
        <input type="text" value={name} maxLength={20} onChange={(e) => setName(e.target.value)} placeholder="例：たこやき大好き" autoComplete="off" />
        <small>本名は書かないでください。</small>
      </label>
      <label className="rd-field">
        <span>メッセージ（200 字まで）</span>
        <textarea value={text} maxLength={200} rows={4} onChange={(e) => setText(e.target.value)} placeholder="例：〇〇先生の好きな食べ物は何ですか？" />
        <small>{text.length}/200 字</small>
      </label>
      {/* いたずら対策：人には見えない欄 */}
      <label className="rd-hp" aria-hidden="true">
        ウェブサイト
        <input type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
      </label>
      {error && (
        <p className="rd-err" role="alert">
          {error}
        </p>
      )}
      {sent > 0 && !error && (
        <p className="rd-ok" role="status">
          送りました。ありがとう！（{sent} 通目）
        </p>
      )}
      <button type="submit" className="rd-send" disabled={sending}>
        {sending ? "送っています…" : "▶ ラジオに送る"}
      </button>
    </form>
  );
}
