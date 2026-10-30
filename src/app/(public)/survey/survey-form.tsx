"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { HOW, HOW_LABEL, TRANSPORT, WHO, WHO_GROUPS } from "@/lib/survey";

type Choice = { id: string; name: string; dept: string; color: string };
type Answers = { who: string; how: string[]; howOther: string; transport: string[]; transportOther: string; fav: string[]; favText: string; impression: string };

const EMPTY: Answers = { who: "", how: [], howOther: "", transport: [], transportOther: "", fav: [], favText: "", impression: "" };
const DONE_KEY = "muchu-survey-done";
/** 書きかけの回答（このタブの中だけ。ほかのページへ行って戻っても消えない） */
const DRAFT_KEY = "muchu-survey-draft";
/** 送るのを待つ長さ（電波が弱い所で、いつまでも「送っています…」にしない） */
const SEND_MS = 20_000;
const NET_ERROR = "電波が弱くて送れませんでした。書いた内容は消えていません。電波のよい所で、もう一度『アンケートを送る』を押してください。";

const isBlank = (a: Answers) => !a.who && !a.how.length && !a.howOther && !a.transport.length && !a.transportOther && !a.fav.length && !a.favText && !a.impression;
const reduceMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** 下書きを読む（形のちがうもの・いまは無い選択肢は捨てる） */
function readDraft(raw: string | null, shopIds: Set<string>): Answers | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<Record<keyof Answers, unknown>>;
    const str = (x: unknown, max: number) => (typeof x === "string" ? x.slice(0, max) : "");
    const list = (x: unknown, ok: (s: string) => boolean) => (Array.isArray(x) ? x.filter((s): s is string => typeof s === "string" && ok(s)) : []);
    const a: Answers = {
      who: WHO.includes(str(v.who, 40)) ? str(v.who, 40) : "",
      how: list(v.how, (s) => (HOW as readonly string[]).includes(s)),
      howOther: str(v.howOther, 40),
      transport: list(v.transport, (s) => (TRANSPORT as readonly string[]).includes(s)),
      transportOther: str(v.transportOther, 40),
      fav: list(v.fav, (s) => shopIds.has(s)),
      favText: str(v.favText, 300),
      impression: str(v.impression, 1000),
    };
    return isBlank(a) ? null : a;
  } catch {
    return null;
  }
}

/** 1 行の欄で改行キー（「完了」）を押しても、途中で送らない（変換中の改行はそのまま）。キーボードを閉じる */
function noEnter(e: KeyboardEvent<HTMLInputElement>) {
  if (e.key !== "Enter" || e.nativeEvent.isComposing || e.keyCode === 229) return;
  e.preventDefault();
  e.currentTarget.blur();
}

export function SurveyForm({ shops }: { shops: Choice[] }) {
  const [a, setA] = useState<Answers>(EMPTY);
  const [website, setWebsite] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [answeredBefore, setAnsweredBefore] = useState(false);
  const [restored, setRestored] = useState(false);
  const [ready, setReady] = useState(false);
  const doneRef = useRef<HTMLHeadingElement>(null);
  const topRef = useRef<HTMLDivElement>(null);

  /* eslint-disable react-hooks/set-state-in-effect -- 画面に出てから端末に残したもの（回答済みの印・書きかけ）を読む */
  useEffect(() => {
    try {
      // 前にこのスマホで答えたことがあるか（もう一度答えることもできる）
      if (localStorage.getItem(DONE_KEY)) setAnsweredBefore(true);
    } catch {
      // 覚えられない端末でも答えられる
    }
    try {
      const d = readDraft(sessionStorage.getItem(DRAFT_KEY), new Set(shops.map((s) => s.id)));
      if (d) {
        setA(d);
        setRestored(true);
      }
    } catch {
      // 読めなくても、はじめから答えられる
    }
    setReady(true);
  }, [shops]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // 書いている内容を残す（送れたら消す）
  useEffect(() => {
    if (!ready || done) return;
    try {
      if (isBlank(a)) sessionStorage.removeItem(DRAFT_KEY);
      else sessionStorage.setItem(DRAFT_KEY, JSON.stringify(a));
    } catch {
      // 残せなくても、送ることはできる
    }
  }, [a, ready, done]);

  // 送れたら、お礼の見出しへ（読み上げでも分かるように）
  useEffect(() => {
    if (!done) return;
    doneRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: reduceMotion() ? "auto" : "smooth" });
  }, [done]);

  const set = <K extends keyof Answers>(k: K, v: Answers[K]) => setA((cur) => ({ ...cur, [k]: v }));
  const toggle = (k: "how" | "transport" | "fav", v: string) =>
    setA((cur) => ({ ...cur, [k]: cur[k].includes(v) ? cur[k].filter((x) => x !== v) : [...cur[k], v] }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (sending) return;
    setError("");
    setSending(true);
    // AbortSignal.timeout は古い iPhone に無いので、自分で 20 秒で止める
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), SEND_MS);
    try {
      const r = await fetch("/api/survey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...a, website }),
        signal: ctl.signal,
      });
      const j = (await r.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!r.ok || !j?.ok) {
        // サーバーの文（「どれか 1 つでも答えてから…」など）はそのまま。文が無いときは電波の文
        setError(j?.error || NET_ERROR);
        return;
      }
      try {
        localStorage.setItem(DONE_KEY, String(Date.now()));
        sessionStorage.removeItem(DRAFT_KEY);
      } catch {}
      setRestored(false);
      setDone(true);
    } catch {
      // 電波が切れた・20 秒たっても返事がない（英語の「Failed to fetch」「Load failed」は出さない）
      setError(NET_ERROR);
    } finally {
      clearTimeout(timer);
      setSending(false);
    }
  }

  /** 続けてほかの方が答える：入力を空にして上へ */
  function again() {
    setA(EMPTY);
    setWebsite("");
    setError("");
    setAnsweredBefore(true);
    setDone(false);
    window.scrollTo({ top: 0, behavior: reduceMotion() ? "auto" : "smooth" });
    requestAnimationFrame(() => topRef.current?.focus({ preventScroll: true }));
  }

  if (done) {
    return (
      <div className="sv-done">
        <h2 ref={doneRef} tabIndex={-1} className="sv-done-t">
          アンケートにご協力いただき、ありがとうございました。
        </h2>
        <p>エンカレ夢中万博 実行委員一同</p>
        <p className="sv-done-links">
          <Link href="/">ホームへ</Link>
          <Link href="/shops">お店・出し物を見る</Link>
        </p>
        <button type="button" className="sv-again" onClick={again}>
          続けてほかの方も答える
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="sv-top" ref={topRef} tabIndex={-1}>
        <p className="sv-lead">
          本日はエンカレ夢中万博にお越しいただき、ありがとうございます。よりよい行事にするために、アンケートへのご協力をお願いします。
          <br />
          <strong>どの問いも、答えられるものだけで大丈夫です。</strong>お名前や連絡先はうかがいません。
        </p>
        {answeredBefore && <p className="sv-note">このスマホからは、もう回答をいただいています。ありがとうございます。続けてほかの方が答えることもできます。</p>}
        {restored && (
          <p className="sv-note" role="status">
            書きかけの回答を戻しました。
          </p>
        )}
      </div>

      <form className="sv-form" onSubmit={submit} noValidate>
        <fieldset className="sv-q">
          <legend>
            <span className="sv-no">1</span>あなたについて、あてはまるものを 1 つ選んでください（よろしければ）
          </legend>
          {WHO_GROUPS.map((g) => (
            <div key={g.label} className="sv-group">
              <p className="sv-group-l">{g.label}</p>
              <div className="sv-chips">
                {g.options.map((o) => (
                  <label key={o} className="sv-chip">
                    <input type="radio" name="who" value={o} checked={a.who === o} onChange={() => set("who", o)} />
                    <span>{o.replace("関係者（その他）", "その他")}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
          {a.who && (
            <button type="button" className="sv-clear" onClick={() => set("who", "")}>
              選ぶのをやめる
            </button>
          )}
        </fieldset>

        <fieldset className="sv-q">
          <legend>
            <span className="sv-no">2</span>エンカレ夢中万博を知ったきっかけ（いくつでも）
          </legend>
          <div className="sv-chips">
            {HOW.map((o) => (
              <label key={o} className="sv-chip">
                <input type="checkbox" checked={a.how.includes(o)} onChange={() => toggle("how", o)} />
                <span>{HOW_LABEL[o]}</span>
              </label>
            ))}
          </div>
          <label className="sv-text">
            <span>その他</span>
            <input type="text" value={a.howOther} maxLength={40} enterKeyHint="done" onKeyDown={noEnter} onChange={(e) => set("howOther", e.target.value)} placeholder="例：地域の掲示板" />
          </label>
        </fieldset>

        <fieldset className="sv-q">
          <legend>
            <span className="sv-no">3</span>来るときの交通手段（いくつでも）
          </legend>
          <div className="sv-chips">
            {TRANSPORT.map((o) => (
              <label key={o} className="sv-chip">
                <input type="checkbox" checked={a.transport.includes(o)} onChange={() => toggle("transport", o)} />
                <span>{o}</span>
              </label>
            ))}
          </div>
          <label className="sv-text">
            <span>その他</span>
            <input
              type="text"
              value={a.transportOther}
              maxLength={40}
              enterKeyHint="done"
              onKeyDown={noEnter}
              onChange={(e) => set("transportOther", e.target.value)}
              placeholder="例：タクシー"
            />
          </label>
        </fieldset>

        <fieldset className="sv-q" aria-describedby="sv-q4-hint">
          <legend>
            <span className="sv-no">4</span>印象に残ったお店・出し物（いくつでも）
          </legend>
          <p className="sv-hint" id="sv-q4-hint">
            押すと選べます。もう一度押すと外れます。
          </p>
          <div className="sv-chips sv-chips--shops">
            {shops.map((s) => (
              <label key={s.id} className={`sv-chip sv-chip--shop tone-${s.color}`}>
                <input type="checkbox" checked={a.fav.includes(s.id)} onChange={() => toggle("fav", s.id)} />
                <span>
                  <span className="sv-shop-t">
                    <small>{s.dept}</small>
                    {s.name}
                  </span>
                  <span className="sv-box" aria-hidden="true" />
                </span>
              </label>
            ))}
          </div>
          <label className="sv-text">
            <span>よかったところ・ほかに印象に残ったもの</span>
            <textarea value={a.favText} maxLength={300} rows={3} onChange={(e) => set("favText", e.target.value)} placeholder="例：バンド演奏がかっこよかった" />
          </label>
        </fieldset>

        <fieldset className="sv-q">
          <legend>
            <span className="sv-no">5</span>最後に、エンカレ夢中万博のご感想をお願いします
          </legend>
          <label className="sv-text">
            <span className="sr-only">ご感想</span>
            <textarea value={a.impression} maxLength={1000} rows={5} onChange={(e) => set("impression", e.target.value)} placeholder="ご自由にお書きください" />
          </label>
        </fieldset>

        {/* いたずら対策：人には見えない欄 */}
        <label className="sv-hp" aria-hidden="true">
          ウェブサイト
          <input type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
        </label>

        {error && (
          <p className="sv-err" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="sv-send" disabled={sending}>
          {sending ? "送っています…" : "▶ アンケートを送る"}
        </button>
        <p className="sv-small">送った内容は、実行委員と先生だけが見ます。行事をよくするためだけに使います。</p>
      </form>
    </>
  );
}
