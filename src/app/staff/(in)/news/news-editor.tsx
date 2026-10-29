"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox, TextArea } from "@/components/ui/field";
import type { News } from "@/lib/types";
import { savedAt, send } from "../../_lib/client";

function hm(at: number) {
  const d = new Date(at);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function NewsEditor({ news: initial }: { news: News[] }) {
  const router = useRouter();
  const [news, setNews] = useState(initial);
  const [text, setText] = useState("");
  const [pinned, setPinned] = useState(false);
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  async function post(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return setError("お知らせの文を入れてください");
    setPending(true);
    setError("");
    const r = await send<{ news: News }>("/api/staff/news", "POST", { text, pinned });
    setPending(false);
    if (!r.ok) return setError(r.error);
    setNews((list) => [r.news, ...list]);
    setText("");
    setPinned(false);
    setMsg(`出しました ・ ${savedAt()}`);
    router.refresh();
  }

  async function remove(id: string) {
    if (!window.confirm("このお知らせを消しますか？")) return;
    const r = await send(`/api/staff/news/${id}`, "DELETE");
    if (!r.ok) return setError(r.error);
    setNews((list) => list.filter((n) => n.id !== id));
    setMsg("消しました");
  }

  return (
    <div className="st-stack">
      <Card title="新しいお知らせ">
        <form onSubmit={post} noValidate>
          <TextArea label="お知らせの文" value={text} maxLength={140} rows={3} onChange={(e) => setText(e.target.value)} hint={`例：13:00 から中庭でバンド演奏があります（${text.length}/140 字）`} />
          <Checkbox label="いちばん上に固定する" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
          <div className="st-row" style={{ marginTop: 12 }}>
            <Button type="submit" variant="primary" icon="お知らせ" pending={pending}>
              お知らせを出す
            </Button>
            <span className="st-saved" role="status" aria-live="polite">
              {msg}
            </span>
          </div>
          {error && (
            <p className="st-err" role="alert">
              {error}
            </p>
          )}
        </form>
      </Card>

      <Card title={`出ているお知らせ（${news.length}）`}>
        {news.length === 0 ? (
          <p className="st-muted">まだありません。</p>
        ) : (
          <ul className="st-list">
            {news.map((n) => (
              <li key={n.id} className="st-list-row">
                <span className="st-grow">
                  {n.pinned && <span className="st-badge" data-v="break">固定</span>} {n.text}
                  <br />
                  <span className="st-muted">{hm(n.at)}</span>
                </span>
                <Button variant="danger" size="sm" icon="消す" onClick={() => remove(n.id)}>
                  消す
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
