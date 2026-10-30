"use client";

import { useState, type FormEvent, type KeyboardEvent } from "react";
import { MSG_KINDS, type MsgKind } from "@/lib/radio";

/** 送るのを待つ長さ（電波が弱い所で、いつまでも「送っています…」にしない） */
const SEND_MS = 20_000;
const NET_ERROR = "電波が弱くて送れませんでした。書いたメッセージは消えていません。電波のよい所で、もう一度『ラジオに送る』を押してください。";
/** 種類ごとの入力例 */
const EXAMPLE: Record<MsgKind, string> = {
  質問: "例：〇〇先生の好きな食べ物は何ですか？",
  メッセージ: "例：焼きそばおいしかったです！",
  リクエスト: "例：曲名とアーティスト名",
  クイズの答え: "例：第 2 問の答えは『3』",
};

/** 1 行の欄で改行キーを押しても、途中で送らない（変換中の改行はそのまま）。キーボードを閉じる */
function noEnter(e: KeyboardEvent<HTMLInputElement>) {
  if (e.key !== "Enter" || e.nativeEvent.isComposing || e.keyCode === 229) return;
  e.preventDefault();
  e.currentTarget.blur();
}

/** ラジオへのメッセージを送る欄 */
export function MessageForm() {
  const [kind, setKind] = useState<MsgKind>("メッセージ");
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [website, setWebsite] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [hint, setHint] = useState("");
  /** 送れたもの（種類と、何通目か） */
  const [sent, setSent] = useState<{ kind: MsgKind; n: number } | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (sending) return;
    setError("");
    setHint("");
    if (!text.trim()) {
      // 送れたあとにもう一度押したときは、「送りました」を消さずに続け方を案内する
      if (sent) return setHint("続けて送るときは、メッセージを書いてから押してください。");
      return setError("メッセージを書いてください。");
    }
    setSending(true);
    // AbortSignal.timeout は古い iPhone に無いので、自分で 20 秒で止める
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), SEND_MS);
    try {
      const r = await fetch("/api/radio/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, name, text, website }),
        signal: ctl.signal,
      });
      const j = (await r.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!r.ok || !j?.ok) {
        // サーバーの文はそのまま。文が無いときは電波の文
        setError(j?.error || NET_ERROR);
        return;
      }
      setText("");
      setSent((s) => ({ kind, n: (s?.n ?? 0) + 1 }));
    } catch {
      // 電波が切れた・20 秒たっても返事がない（英語の「Failed to fetch」などは出さない）
      setError(NET_ERROR);
    } finally {
      clearTimeout(timer);
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
        <span>ラジオネーム（書かなくても大丈夫です・20 字まで）</span>
        <input
          type="text"
          value={name}
          maxLength={20}
          enterKeyHint="done"
          onKeyDown={noEnter}
          onChange={(e) => setName(e.target.value)}
          placeholder="例：たこやき大好き"
          autoComplete="off"
        />
        <small>本名は書かないでください。</small>
      </label>
      <div className="rd-field">
        <label htmlFor="rd-text">{kind}（200 字まで）</label>
        <textarea id="rd-text" value={text} maxLength={200} rows={4} onChange={(e) => setText(e.target.value)} placeholder={EXAMPLE[kind]} aria-describedby="rd-count" />
        <small id="rd-count">{text.length}/200 字</small>
      </div>
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
      <div role="status">
        {sent && !error && (
          <p className="rd-ok">
            『{sent.kind}』を送りました。ありがとうございます（{sent.n} 通目）
          </p>
        )}
        {hint && <p className="rd-hint">{hint}</p>}
      </div>
      <button type="submit" className="rd-send" disabled={sending}>
        {sending ? "送っています…" : "▶ ラジオに送る"}
      </button>
    </form>
  );
}
