"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { Phase } from "@/lib/ops";
import { MSG_KINDS, type ProgramRow, type RadioMsg, type RadioState } from "@/lib/radio";
import { clock, send } from "../../_lib/client";
import { markAlive, markExpired, noteAuth } from "../_components/session-signal";
import { clockNow } from "../ops-live";
import { everyText, failMsg, pollMs, REACH, ResultLine, type Result } from "../ops-result";
import { useUnsavedGuard } from "../shops/[id]/use-unsaved-guard";

type Where = "air" | "prog" | "msg";

/**
 * 校内ラジオ（実行委員だけ）。ON AIR・いまの内容・番組表・届いたメッセージ。
 * 当日は 15 秒ごと（開催前・終了後は 1 分ごと）に読み直す（ほかの実行委員が ON AIR にした・新しいメッセージが届いた、が入る）。
 * 書きかけの「いまの内容」と番組表は、読み直しで上書きしない。押した結果は、押した箱の中に出す。
 * 書きかけがあるあいだは、ほかの画面へ移る前に聞く（下のタブで黙って消えないように）。
 */
export function RadioAdmin({
  state: first,
  messages: firstMsgs,
  readIds,
  ready,
  phase,
}: {
  state: RadioState;
  messages: RadioMsg[];
  readIds: string[];
  ready: boolean;
  /** ページを開いたときの、お客さんの画面の出し方（読み直しの間隔を決める） */
  phase: Phase;
}) {
  const every = pollMs(phase);
  const [state, setState] = useState(first);
  const [messages, setMessages] = useState(firstMsgs);
  const [read, setRead] = useState(() => new Set(readIds));
  /** ページを開いたときにあったメッセージ（これ以外は「新しい」） */
  const [known] = useState(() => new Set(firstMsgs.map((m) => m.id)));
  const [now, setNow] = useState(first.now);
  const [nowDirty, setNowDirty] = useState(false);
  const [program, setProgram] = useState<ProgramRow[]>(first.program);
  const [progDirty, setProgDirty] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [hideRead, setHideRead] = useState(false);
  const [busy, setBusy] = useState<Where | null>(null);
  const [result, setResult] = useState<Partial<Record<Where, Result>>>({});
  const [markErr, setMarkErr] = useState<{ id: string; text: string } | null>(null);
  const [clearOpen, setClearOpen] = useState(false);
  /** 変えた回数。読み込みを始めたあとに変えていたら、その読み込みは古いので使わない */
  const changes = useRef(0);
  useUnsavedGuard(nowDirty || progDirty, "書きかけ（いまの内容・番組表）を、まだ保存していません。この画面を離れると消えます。離れますか？");

  // 読み直した状態が届いたら、書きかけでない欄だけ入れかえる
  const [seen, setSeen] = useState(first);
  if (seen !== state) {
    setSeen(state);
    if (!nowDirty) setNow(state.now);
    if (!progDirty) setProgram(state.program);
  }

  useEffect(() => {
    let stop = false;
    async function load() {
      if (document.visibilityState !== "visible") return;
      const v = changes.current;
      try {
        const r = await fetch("/api/staff/radio", { cache: "no-store", credentials: "same-origin" });
        const j = (await r.json().catch(() => null)) as { ok?: boolean; state?: RadioState; messages?: RadioMsg[]; readIds?: string[] } | null;
        if (stop) return;
        // 実行委員でなくなった（ログインが切れた）ら、画面のいちばん上に知らせる
        if (r.status === 401 || r.status === 403) return markExpired();
        if (r.ok && j?.ok) markAlive();
        if (!r.ok || !j?.ok || v !== changes.current) return;
        if (j.state) setState(j.state);
        if (j.messages) setMessages(j.messages);
        if (j.readIds) setRead(new Set(j.readIds));
      } catch {
        // 電波が弱いときは、次の読み込みで
      }
    }
    const t = setInterval(load, every);
    const onVis = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stop = true;
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [every]);

  const say = (where: Where, r: Result) => setResult((p) => ({ ...p, [where]: r }));

  /**
   * 状態を変える（送った欄だけ）。what は「放送を始める」など（失敗の文に使う）、done は「放送を始めました」など。
   * after は時刻のあとに続ける文（「当日は 20 秒ほどで…」）
   */
  async function put(patch: Partial<RadioState>, where: Where, what: string, done: string, after = "") {
    // 送っているあいだは、ほかのボタンを押しても何もしない（ボタンは disabled にせず「押せない」印だけ。キーボードで選んでいた所が消えないように）
    if (busy) return false;
    setBusy(where);
    say(where, null);
    changes.current++;
    const r = noteAuth(await send<{ state: RadioState }>("/api/staff/radio", "PUT", patch));
    setBusy(null);
    if (!r.ok) {
      say(where, { text: failMsg(`${what}ことが`, r, "少しして読み直したら、変わったか確かめてください"), error: true });
      return false;
    }
    changes.current++;
    setState(r.state);
    say(where, { text: `${done}（${clockNow()}）${after}` });
    return true;
  }

  async function mark(id: string, v: boolean) {
    setMarkErr(null);
    changes.current++;
    setRead((p) => {
      const next = new Set(p);
      if (v) next.add(id);
      else next.delete(id);
      return next;
    });
    const r = noteAuth(await send<{ readIds: string[] }>("/api/staff/radio/read", "PUT", { ids: [id], read: v }));
    changes.current++;
    if (!r.ok) {
      setRead((p) => {
        const next = new Set(p);
        if (v) next.delete(id);
        else next.add(id);
        return next;
      });
      return setMarkErr({ id, text: failMsg(v ? "「読んだ」にすることが" : "「読んだ」を取り消すことが", r, "少しして読み直したら、確かめてください") });
    }
    setRead(new Set(r.readIds));
  }

  async function clearAll() {
    changes.current++;
    const r = noteAuth(await send("/api/staff/radio", "DELETE", { confirm: "消す" }));
    changes.current++;
    if (!r.ok) return say("msg", { text: failMsg("メッセージを全部消すことが", r, "少しして読み直したら、消えているか確かめてください"), error: true });
    setMessages([]);
    setRead(new Set());
    say("msg", { text: `メッセージを全部消しました（${clockNow()}）` });
  }

  const byKind = messages.filter((m) => filter === "all" || m.kind === filter);
  const shown = byKind.filter((m) => !hideRead || !read.has(m.id));
  const unread = messages.filter((m) => !read.has(m.id)).length;
  const fresh = messages.filter((m) => !known.has(m.id) && !read.has(m.id)).length;
  const empty =
    messages.length === 0 ? "メッセージはまだありません。" : byKind.length === 0 ? "この種類のメッセージはありません。" : "読んでいないメッセージはありません。";

  return (
    <div className="st-stack rda">
      {!ready && <p className="st-err">保存先（Upstash）がつながっていないので、変えられません。</p>}

      <section className={state.onAir ? "rda-air rda-air--on" : "rda-air"} aria-labelledby="rda-air-h">
        <h2 id="rda-air-h" className="rda-air-state">
          <span className="rda-lamp" aria-hidden="true" />
          {state.onAir ? "ON AIR（放送中）" : "放送していません"}
        </h2>
        {state.onAir ? (
          <button type="button" className="rda-air-btn" disabled={!ready} aria-disabled={!!busy || undefined} aria-busy={busy === "air" || undefined} onClick={() => put({ onAir: false }, "air", "放送を終える", "放送を終えました", "。当日は 20 秒ほどで、お客さんの画面から「放送中」が消えます（開催前は、数分かかることがあります）")}>
            ■ 放送を終える
          </button>
        ) : (
          <button type="button" className="rda-air-btn" disabled={!ready} aria-disabled={!!busy || undefined} aria-busy={busy === "air" || undefined} onClick={() => put({ onAir: true }, "air", "放送を始める", "放送を始めました", `。${REACH.replace("出ます", "「放送中」が出ます")}`)}>
            ● 放送を始める（ON AIR）
          </button>
        )}
        <form
          className="rda-now"
          onSubmit={async (e) => {
            e.preventDefault();
            const ok = await put({ now: now.trim() }, "air", "いまの内容を保存する", state.onAir ? "いまの内容を画面に出しました" : "いまの内容を保存しました。放送を始めると画面に出ます");
            if (ok) setNowDirty(false);
          }}
        >
          <label>
            <span>いま放送している内容（お客さんの画面に出る・60 字まで）</span>
            <input
              type="text"
              value={now}
              maxLength={60}
              onChange={(e) => {
                setNow(e.target.value);
                setNowDirty(true);
              }}
              placeholder="例：クイズ大会！ 会場の答えはメッセージで"
            />
          </label>
          <Button type="submit" variant="secondary" pending={busy === "air"} disabled={!ready}>
            {state.onAir ? "画面に出す" : "保存する"}
          </Button>
        </form>
        {fresh > 0 && (
          <a href="#rda-msg-h" className="rda-fresh">
            新しいメッセージが {fresh} 通届いています
          </a>
        )}
        <ResultLine r={result.air ?? null} />
      </section>

      <section className="st-card rda-card" aria-labelledby="rda-prog-h">
        <h2 id="rda-prog-h">番組表</h2>
        <p className="st-muted">「10:30」「午後」など。お客さんのラジオのページに出ます。</p>
        <ol className="rda-prog">
          {program.map((p, i) => (
            <li key={i}>
              <input
                aria-label={`${i + 1} 行目の時刻`}
                type="text"
                value={p.time}
                maxLength={20}
                placeholder="10:30"
                onChange={(e) => {
                  setProgram((l) => l.map((x, j) => (j === i ? { ...x, time: e.target.value } : x)));
                  setProgDirty(true);
                }}
              />
              <input
                aria-label={`${i + 1} 行目の内容`}
                type="text"
                value={p.text}
                maxLength={80}
                placeholder="オープニング・お店の紹介"
                onChange={(e) => {
                  setProgram((l) => l.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)));
                  setProgDirty(true);
                }}
              />
              <Button
                size="sm"
                variant="ghost"
                icon="消す"
                onClick={() => {
                  setProgram((l) => l.filter((_, j) => j !== i));
                  setProgDirty(true);
                }}
                aria-label={`${i + 1} 行目を消す`}
              >
                消す
              </Button>
            </li>
          ))}
        </ol>
        <div className="st-row">
          <Button
            size="sm"
            icon="足す"
            disabled={program.length >= 20}
            onClick={() => {
              setProgram((l) => [...l, { time: "", text: "" }]);
              setProgDirty(true);
            }}
          >
            行を足す
          </Button>
          <Button
            variant="primary"
            pending={busy === "prog"}
            disabled={!ready}
            onClick={async () => {
              const rows = program.map((p) => ({ time: p.time.trim(), text: p.text.trim() })).filter((p) => p.text);
              setProgram(rows);
              if (await put({ program: rows }, "prog", "番組表を保存する", "番組表を保存しました")) setProgDirty(false);
            }}
          >
            番組表を保存
          </Button>
          {progDirty && <span className="st-muted">まだ保存していません</span>}
        </div>
        <ResultLine r={result.prog ?? null} />
      </section>

      <section className="st-card rda-card" aria-labelledby="rda-msg-h">
        <div className="rda-msg-head">
          <h2 id="rda-msg-h">
            届いたメッセージ（{messages.length} 通・まだ読んでいない {unread} 通）
            {fresh > 0 && <span className="rda-new">新しい {fresh} 通</span>}
          </h2>
          {state.msgOpen ? (
            <Button size="sm" variant="secondary" disabled={!ready} pending={busy === "msg"} onClick={() => put({ msgOpen: false }, "msg", "募集を止める", "募集を止めました")}>
              募集を止める
            </Button>
          ) : (
            <Button size="sm" variant="primary" disabled={!ready} pending={busy === "msg"} onClick={() => put({ msgOpen: true }, "msg", "募集を始める", "募集を始めました")}>
              募集を始める
            </Button>
          )}
        </div>
        <p className="st-muted">
          募集：{state.msgOpen ? "受け付けています" : "止めています"}。新しい順（{everyText(phase)}に読み直します）。読み上げたら「読んだ」を押すと、灰色になります。
        </p>
        <ResultLine r={result.msg ?? null} />
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
                    {!known.has(m.id) && !isRead && <span className="rda-new">新しい</span>}
                    <span className="rda-kind">{m.kind}</span>
                    {clock(m.at)}
                    {m.name ? ` ・ ${m.name}` : " ・ （ラジオネームなし）"}
                  </p>
                  <p className="rda-msg-text">{m.text}</p>
                  <Button size="sm" variant={isRead ? "ghost" : "secondary"} disabled={!ready} onClick={() => mark(m.id, !isRead)}>
                    {isRead ? "「読んだ」を取り消す" : "✓ 読んだ"}
                  </Button>
                  {markErr?.id === m.id && (
                    <p className="ops-result ops-result--ng" role="alert">
                      {markErr.text}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="st-muted">{empty}</p>
        )}
        <div className="st-row rda-danger">
          <Button variant="danger" icon="消す" disabled={!ready || messages.length === 0} onClick={() => setClearOpen(true)} aria-haspopup="dialog">
            メッセージを全部消す
          </Button>
        </div>
      </section>

      <ConfirmDialog title={`届いたメッセージ ${messages.length} 通を全部消しますか？`} confirmLabel="全部消す" open={clearOpen} onOpenChange={setClearOpen} onConfirm={clearAll}>
        元に戻せません。前日の練習のあとや、試しのメッセージを消すときに使います。
      </ConfirmDialog>
    </div>
  );
}
