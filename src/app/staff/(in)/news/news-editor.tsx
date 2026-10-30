"use client";

import { useState, type Dispatch, type FormEvent, type SetStateAction } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Checkbox, TextArea } from "@/components/ui/field";
import type { News } from "@/lib/types";
import { clock, send } from "../../_lib/client";
import { clockNow } from "../ops-live";
import { ResultLine, type Result } from "../ops-result";

/** 「11/28 13:05」（日本時間。サーバーと画面で同じ文になる） */
const WHEN = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit" });
/** トップと同じ並び（固定が上、新しい順） */
const sorted = (list: News[]) => [...list].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.at - a.at);

type Props = { news: News[]; setNews: Dispatch<SetStateAction<News[]>>; touch: () => void; ready: boolean };

/** 全体のお知らせ（お客さんの画面のトップに出す）を出す・直す・消す */
export function NewsEditor({ news, setNews, touch, ready }: Props) {
  const [text, setText] = useState("");
  const [pinned, setPinned] = useState(false);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<Result>(null);
  const [listResult, setListResult] = useState<Result>(null);

  async function post(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return setResult({ text: "お知らせの文を入れてください", error: true });
    setPending(true);
    setResult(null);
    touch();
    const r = await send<{ news: News }>("/api/staff/news", "POST", { text, pinned });
    setPending(false);
    if (!r.ok) return setResult({ text: r.error, error: true });
    touch();
    setNews((list) => sorted([r.news, ...list.filter((n) => n.id !== r.news.id)]));
    setText("");
    setPinned(false);
    setResult({ text: `お知らせを出しました（${clock(r.news.at)}）。お客さんの画面には 15 秒ほどで出ます` });
  }

  return (
    <>
      <Card title="新しいお知らせ" id="news">
        <form onSubmit={post} noValidate>
          <TextArea
            label="お知らせの文"
            value={text}
            maxLength={140}
            rows={3}
            onChange={(e) => setText(e.target.value)}
            hint={`例：13:00 から中庭でバンド演奏があります（${text.length}/140 字）`}
          />
          <p className="ops-note">落とし物は物の特徴だけ（名前は書かない）。例：黒い折りたたみ傘を受付でお預かりしています</p>
          <Checkbox label="いちばん上に固定する" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
          <div className="st-row" style={{ marginTop: 8 }}>
            <Button type="submit" variant="primary" icon="お知らせ" pending={pending} disabled={!ready}>
              お知らせを出す
            </Button>
          </div>
          <ResultLine r={result} />
        </form>
      </Card>

      <Card title={`出ているお知らせ（${news.length}）`}>
        {news.length === 0 ? (
          <p className="st-muted">いまは出ていません。</p>
        ) : (
          <ul className="ops-news-list">
            {news.map((n) => (
              <NewsItem
                key={n.id}
                n={n}
                ready={ready}
                touch={touch}
                onSaved={(x) => setNews((list) => sorted(list.map((y) => (y.id === x.id ? x : y))))}
                onRemoved={(id) => {
                  setNews((list) => list.filter((y) => y.id !== id));
                  setListResult({ text: `お知らせを 1 つ消しました（${clockNow()}）` });
                }}
              />
            ))}
          </ul>
        )}
        <ResultLine r={listResult} />
      </Card>
    </>
  );
}

function NewsItem({
  n,
  ready,
  touch,
  onSaved,
  onRemoved,
}: {
  n: News;
  ready: boolean;
  touch: () => void;
  onSaved: (n: News) => void;
  onRemoved: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(n.text);
  const [draftPin, setDraftPin] = useState(n.pinned);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result>(null);
  const [delOpen, setDelOpen] = useState(false);

  async function patch(body: { text?: string; pinned?: boolean }, done: string) {
    setBusy(true);
    setResult(null);
    touch();
    const r = await send<{ news: News }>(`/api/staff/news/${n.id}`, "PATCH", body);
    setBusy(false);
    if (!r.ok) {
      setResult({ text: r.error, error: true });
      return false;
    }
    touch();
    onSaved(r.news);
    setResult({ text: `${done}（${clockNow()}）` });
    return true;
  }

  async function remove() {
    touch();
    const r = await send(`/api/staff/news/${n.id}`, "DELETE");
    if (!r.ok) return setResult({ text: r.error, error: true });
    touch();
    onRemoved(n.id);
  }

  return (
    <li className="ops-news">
      {editing ? (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!draft.trim()) return setResult({ text: "お知らせの文を入れてください", error: true });
            if (await patch({ text: draft, pinned: draftPin }, "直しました")) setEditing(false);
          }}
          noValidate
        >
          <TextArea label="お知らせの文を直す" value={draft} maxLength={140} rows={3} onChange={(e) => setDraft(e.target.value)} hint={`${draft.length}/140 字`} />
          <Checkbox label="いちばん上に固定する" checked={draftPin} onChange={(e) => setDraftPin(e.target.checked)} />
          <div className="ops-news-btns">
            <Button type="submit" variant="primary" size="sm" pending={busy} disabled={!ready}>
              この文に直す
            </Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => setEditing(false)}>
              やめる
            </Button>
          </div>
        </form>
      ) : (
        <>
          <p className="ops-news-text">
            {n.pinned && <span className="ops-pin">固定</span>}
            {n.text}
          </p>
          <p className="ops-news-at">{WHEN.format(n.at)} に出しました</p>
          <div className="ops-news-btns">
            <Button
              size="sm"
              icon="直す"
              disabled={!ready || busy}
              onClick={() => {
                setDraft(n.text);
                setDraftPin(n.pinned);
                setResult(null);
                setEditing(true);
              }}
            >
              直す
            </Button>
            {n.pinned && (
              <Button size="sm" disabled={!ready} pending={busy} onClick={() => patch({ pinned: false }, "固定をやめました")}>
                固定をやめる
              </Button>
            )}
            <Button size="sm" variant="danger" icon="消す" disabled={!ready || busy} onClick={() => setDelOpen(true)} aria-haspopup="dialog">
              消す
            </Button>
          </div>
        </>
      )}
      <ResultLine r={result} />
      <ConfirmDialog title="このお知らせを消しますか？" confirmLabel="消す" open={delOpen} onOpenChange={setDelOpen} onConfirm={remove}>
        「{n.text}」をお客さんの画面からも消します。元に戻すボタンはありません。
      </ConfirmDialog>
    </li>
  );
}
