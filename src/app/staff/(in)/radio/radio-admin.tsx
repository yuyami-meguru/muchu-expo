"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { MSG_KINDS, type ProgramRow, type RadioMsg, type RadioState } from "@/lib/radio";
import { savedAt, send } from "../../_lib/client";

const fmt = (at: number) => new Date(at).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo" });

export function RadioAdmin({ state: initial, messages, readIds: initialRead, ready }: { state: RadioState; messages: RadioMsg[]; readIds: string[]; ready: boolean }) {
  const router = useRouter();
  const [state, setState] = useState(initial);
  const [now, setNow] = useState(initial.now);
  const [program, setProgram] = useState<ProgramRow[]>(initial.program);
  const [read, setRead] = useState(new Set(initialRead));
  const [filter, setFilter] = useState<string>("all");
  const [hideRead, setHideRead] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  async function put(patch: Partial<RadioState>, label: string) {
    setBusy(label);
    setError("");
    const r = await send<{ state: RadioState }>("/api/staff/radio", "PUT", patch);
    setBusy(null);
    if (!r.ok) return setError(r.error);
    setState(r.state);
    setMsg(`${label}を${savedAt()}`);
  }

  async function mark(ids: string[], v: boolean) {
    const r = await send<{ readIds: string[] }>("/api/staff/radio/read", "PUT", { ids, read: v });
    if (!r.ok) return setError(r.error);
    setRead(new Set(r.readIds));
  }

  async function clearAll() {
    if (!window.confirm(`届いたメッセージ ${messages.length} 通を全部消します。元に戻せません。消しますか？`)) return;
    const r = await send("/api/staff/radio", "DELETE", { confirm: "消す" });
    if (!r.ok) return setError(r.error);
    setMsg("メッセージを全部消しました");
    router.refresh();
  }

  const shown = useMemo(
    () => messages.filter((m) => (filter === "all" || m.kind === filter) && (!hideRead || !read.has(m.id))),
    [messages, filter, hideRead, read],
  );
  const unread = messages.filter((m) => !read.has(m.id)).length;

  return (
    <div className="st-stack rda">
      {!ready && <p className="st-err">保存先（Upstash）がつながっていないので、変えられません。</p>}

      <section className={state.onAir ? "rda-air rda-air--on" : "rda-air"} aria-label="放送">
        <p className="rda-air-state">
          <span className="rda-lamp" aria-hidden="true" />
          {state.onAir ? "ON AIR（放送中）" : "放送していません"}
        </p>
        <button type="button" className="rda-air-btn" disabled={!ready || !!busy} aria-pressed={state.onAir} onClick={() => put({ onAir: !state.onAir }, state.onAir ? "放送の終わり" : "放送の始まり")}>
          {state.onAir ? "■ 放送を終える" : "● 放送を始める（ON AIR）"}
        </button>
        <form
          className="rda-now"
          onSubmit={(e) => {
            e.preventDefault();
            put({ now: now.trim() }, "いまの内容");
          }}
        >
          <label>
            <span>いま放送している内容（お客さんの画面に出る・60 字まで）</span>
            <input type="text" value={now} maxLength={60} onChange={(e) => setNow(e.target.value)} placeholder="例：クイズ大会！ 会場の答えはメッセージで" />
          </label>
          <Button type="submit" variant="secondary" pending={busy === "いまの内容"} disabled={!ready}>
            出す
          </Button>
        </form>
      </section>

      <section className="st-card rda-card" aria-labelledby="rda-prog-h">
        <h2 id="rda-prog-h">番組表</h2>
        <p className="st-muted">「10:30」「午後」など。お客さんのラジオのページに出ます。</p>
        <ol className="rda-prog">
          {program.map((p, i) => (
            <li key={i}>
              <input aria-label={`${i + 1} 行目の時刻`} type="text" value={p.time} maxLength={20} placeholder="10:30" onChange={(e) => setProgram((l) => l.map((x, j) => (j === i ? { ...x, time: e.target.value } : x)))} />
              <input aria-label={`${i + 1} 行目の内容`} type="text" value={p.text} maxLength={80} placeholder="オープニング・お店の紹介" onChange={(e) => setProgram((l) => l.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} />
              <Button size="sm" variant="ghost" icon="消す" onClick={() => setProgram((l) => l.filter((_, j) => j !== i))} aria-label={`${i + 1} 行目を消す`}>
                消す
              </Button>
            </li>
          ))}
        </ol>
        <div className="st-row">
          <Button size="sm" icon="足す" disabled={program.length >= 20} onClick={() => setProgram((l) => [...l, { time: "", text: "" }])}>
            行を足す
          </Button>
          <Button
            variant="primary"
            pending={busy === "番組表"}
            disabled={!ready}
            onClick={() => {
              const rows = program.map((p) => ({ time: p.time.trim(), text: p.text.trim() })).filter((p) => p.text);
              setProgram(rows);
              put({ program: rows }, "番組表");
            }}
          >
            番組表を保存
          </Button>
        </div>
      </section>

      <section className="st-card rda-card" aria-labelledby="rda-msg-h">
        <div className="rda-msg-head">
          <h2 id="rda-msg-h">
            届いたメッセージ（{messages.length} 通・まだ読んでいない {unread} 通）
          </h2>
          <Button size="sm" variant={state.msgOpen ? "secondary" : "primary"} disabled={!ready || !!busy} onClick={() => put({ msgOpen: !state.msgOpen }, state.msgOpen ? "募集の停止" : "募集の開始")}>
            {state.msgOpen ? "募集を止める" : "募集を始める"}
          </Button>
        </div>
        <p className="st-muted">募集：{state.msgOpen ? "受け付けています" : "止めています"}。新しい順。読み上げたら「読んだ」を押すと、灰色になります。</p>
        <div className="rda-filter" role="group" aria-label="種類でしぼる">
          {["all", ...MSG_KINDS].map((k) => (
            <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)}>
              {k === "all" ? "ぜんぶ" : k}
            </button>
          ))}
          <label className="rda-hide">
            <input type="checkbox" checked={hideRead} onChange={(e) => setHideRead(e.target.checked)} />
            読んだものを隠す
          </label>
        </div>
        {shown.length ? (
          <ul className="rda-msgs">
            {shown.map((m) => {
              const isRead = read.has(m.id);
              return (
                <li key={m.id} className={isRead ? "rda-msg rda-msg--read" : "rda-msg"}>
                  <p className="rda-msg-meta">
                    <span className="rda-kind">{m.kind}</span>
                    {fmt(m.at)}
                    {m.name ? ` ・ ${m.name}` : " ・ （ラジオネームなし）"}
                  </p>
                  <p className="rda-msg-text">{m.text}</p>
                  <Button size="sm" variant={isRead ? "ghost" : "secondary"} onClick={() => mark([m.id], !isRead)}>
                    {isRead ? "読んでいないに戻す" : "✓ 読んだ"}
                  </Button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="st-muted">メッセージはまだありません。</p>
        )}
        <div className="st-row rda-danger">
          <Button variant="danger" icon="消す" disabled={!ready || messages.length === 0} onClick={clearAll}>
            メッセージを全部消す
          </Button>
        </div>
      </section>

      <p className="st-saved" role="status" aria-live="polite">
        {msg}
      </p>
      {error && (
        <p className="st-err" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
