"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { HOW, TRANSPORT, WHO_GROUPS } from "@/lib/survey";

type Choice = { id: string; name: string; dept: string; color: string };

const DONE_KEY = "muchu-survey-done";

export function SurveyForm({ shops }: { shops: Choice[] }) {
  const [who, setWho] = useState("");
  const [how, setHow] = useState<string[]>([]);
  const [howOther, setHowOther] = useState("");
  const [transport, setTransport] = useState<string[]>([]);
  const [transportOther, setTransportOther] = useState("");
  const [fav, setFav] = useState<string[]>([]);
  const [favText, setFavText] = useState("");
  const [impression, setImpression] = useState("");
  const [website, setWebsite] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [answeredBefore, setAnsweredBefore] = useState(false);

  useEffect(() => {
    try {
      // 前にこの端末で答えたことがあるか（もう一度答えることもできる）
      if (localStorage.getItem(DONE_KEY)) setAnsweredBefore(true); // eslint-disable-line react-hooks/set-state-in-effect
    } catch {
      // 覚えられない端末でも答えられる
    }
  }, []);

  const toggle = (list: string[], set: (v: string[]) => void, v: string) => set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSending(true);
    try {
      const r = await fetch("/api/survey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ who, how, howOther, transport, transportOther, fav, favText, impression, website }),
      });
      const j = (await r.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!r.ok || !j?.ok) throw new Error(j?.error ?? "送れませんでした。電波のよい所で、もう一度送ってください");
      try {
        localStorage.setItem(DONE_KEY, String(Date.now()));
      } catch {}
      setDone(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "送れませんでした");
    } finally {
      setSending(false);
    }
  }

  if (done) {
    return (
      <div className="sv-done" role="status">
        <p className="sv-done-t">アンケートにご協力いただき、ありがとうございました。</p>
        <p>エンカレ夢中万博 実行委員一同</p>
        <p className="sv-done-links">
          <Link href="/">ホームへ</Link>
          <Link href="/shops">お店・出し物を見る</Link>
        </p>
      </div>
    );
  }

  return (
    <form className="sv-form" onSubmit={submit} noValidate>
      {answeredBefore && <p className="sv-note">この端末からは、もう回答をいただいています。ありがとうございます。続けてほかの方が答えることもできます。</p>}

      <fieldset className="sv-q">
        <legend>
          <span className="sv-no">1</span>よろしければ、あてはまるものを 1 つ選んでください
        </legend>
        {WHO_GROUPS.map((g) => (
          <div key={g.label} className="sv-group">
            <p className="sv-group-l">{g.label}</p>
            <div className="sv-chips">
              {g.options.map((o) => (
                <label key={o} className="sv-chip">
                  <input type="radio" name="who" value={o} checked={who === o} onChange={() => setWho(o)} />
                  <span>{o.replace("関係者（その他）", "その他")}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
        {who && (
          <button type="button" className="sv-clear" onClick={() => setWho("")}>
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
              <input type="checkbox" checked={how.includes(o)} onChange={() => toggle(how, setHow, o)} />
              <span>{o}</span>
            </label>
          ))}
        </div>
        <label className="sv-text">
          <span>その他</span>
          <input type="text" value={howOther} maxLength={40} onChange={(e) => setHowOther(e.target.value)} placeholder="例：地域の掲示板" />
        </label>
      </fieldset>

      <fieldset className="sv-q">
        <legend>
          <span className="sv-no">3</span>来るときの交通手段（いくつでも）
        </legend>
        <div className="sv-chips">
          {TRANSPORT.map((o) => (
            <label key={o} className="sv-chip">
              <input type="checkbox" checked={transport.includes(o)} onChange={() => toggle(transport, setTransport, o)} />
              <span>{o}</span>
            </label>
          ))}
        </div>
        <label className="sv-text">
          <span>その他</span>
          <input type="text" value={transportOther} maxLength={40} onChange={(e) => setTransportOther(e.target.value)} placeholder="例：タクシー" />
        </label>
      </fieldset>

      <fieldset className="sv-q">
        <legend>
          <span className="sv-no">4</span>印象に残ったお店・出し物（いくつでも）
        </legend>
        <div className="sv-chips sv-chips--shops">
          {shops.map((s) => (
            <label key={s.id} className={`sv-chip sv-chip--shop tone-${s.color}`}>
              <input type="checkbox" checked={fav.includes(s.id)} onChange={() => toggle(fav, setFav, s.id)} />
              <span>
                <small>{s.dept}</small>
                {s.name}
              </span>
            </label>
          ))}
        </div>
        <label className="sv-text">
          <span>よかったところ・ほかに印象に残ったもの</span>
          <textarea value={favText} maxLength={300} rows={3} onChange={(e) => setFavText(e.target.value)} placeholder="例：バンド演奏がかっこよかった" />
        </label>
      </fieldset>

      <fieldset className="sv-q">
        <legend>
          <span className="sv-no">5</span>最後に、エンカレ夢中万博のご感想をお願いします
        </legend>
        <label className="sv-text">
          <span className="sr-only">ご感想</span>
          <textarea value={impression} maxLength={1000} rows={5} onChange={(e) => setImpression(e.target.value)} placeholder="ご自由にお書きください" />
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
  );
}
