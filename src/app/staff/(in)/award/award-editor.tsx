"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch, TextArea, TextField } from "@/components/ui/field";
import type { AwardSetting } from "@/app/(public)/award/award-data";
import { savedAt, send } from "../../_lib/client";

type ShopChoice = { id: string; name: string; dept: string; color: string };

/** 夢中アワードの編集。全部まとめて「保存」で送る */
export function AwardEditor({
  initial,
  shops,
  counts,
  total,
  ready,
}: {
  initial: AwardSetting;
  shops: ShopChoice[];
  counts: Record<string, number>;
  total: number;
  ready: boolean;
}) {
  const router = useRouter();
  const [a, setA] = useState<AwardSetting>(initial);
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const shopOf = useMemo(() => new Map(shops.map((s) => [s.id, s])), [shops]);
  const ranking = useMemo(() => [...shops].sort((x, y) => (counts[y.id] ?? 0) - (counts[x.id] ?? 0)), [shops, counts]);

  const change = (next: AwardSetting) => {
    setA(next);
    setDirty(true);
    setMsg("");
  };
  const setAward = (i: number, patch: Partial<AwardSetting["awards"][number]>) =>
    change({ ...a, awards: a.awards.map((x, k) => (k === i ? { ...x, ...patch } : x)) });

  function addAward() {
    let n = a.awards.length + 1;
    while (a.awards.some((x) => x.id === `award-${n}`)) n++;
    change({ ...a, awards: [...a.awards, { id: `award-${n}`, name: "", note: "", winners: [] }] });
  }
  function move(i: number, d: -1 | 1) {
    const j = i + d;
    if (j < 0 || j >= a.awards.length) return;
    const list = [...a.awards];
    [list[i], list[j]] = [list[j], list[i]];
    change({ ...a, awards: list });
  }

  async function save(next = a) {
    if (!next.title.trim()) return setError("アワードの名前を入れてください");
    const bad = next.awards.findIndex((x) => !x.name.trim());
    if (bad >= 0) return setError(`${bad + 1} つ目の賞の名前を入れてください`);
    setPending(true);
    setError("");
    const r = await send<{ award: AwardSetting }>("/api/staff/award", "PUT", next);
    setPending(false);
    if (!r.ok) return setError(r.error);
    setA(r.award);
    setDirty(false);
    setMsg(savedAt());
    router.refresh();
  }

  async function togglePublish() {
    const next = { ...a, published: !a.published };
    if (next.published && !window.confirm("お客さんのページに受賞を出します。発表しますか？")) return;
    await save(next);
  }

  return (
    <div className="aw-ed">
      <div className="aw-ed-main">
        <section className="aw-ed-card">
          <h2>発表</h2>
          <Switch
            label={a.published ? "発表しています（お客さんに見えています）" : "まだ発表していません"}
            hint="オンにすると、お客さんの「アワード」のページとホームに受賞が出ます"
            checked={a.published}
            onChange={togglePublish}
            disabled={!ready || pending}
          />
          <div className="aw-ed-grid">
            <TextField label="アワードの名前" value={a.title} maxLength={20} onChange={(e) => change({ ...a, title: e.target.value })} />
            <TextField
              label="発表前に出す文"
              value={a.teaser}
              maxLength={40}
              placeholder="例：14:00 ごろ発表します"
              onChange={(e) => change({ ...a, teaser: e.target.value })}
            />
          </div>
        </section>

        {a.awards.map((aw, i) => {
          const chosen = new Set(aw.winners.map((w) => w.shop));
          return (
            <section key={aw.id} className="aw-ed-card">
              <div className="aw-ed-head">
                <h2>賞 {i + 1}</h2>
                <span className="aw-ed-move">
                  <Button size="sm" variant="ghost" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`賞 ${i + 1} を上へ`}>
                    ↑ 上へ
                  </Button>
                  <Button size="sm" variant="ghost" disabled={i === a.awards.length - 1} onClick={() => move(i, 1)} aria-label={`賞 ${i + 1} を下へ`}>
                    ↓ 下へ
                  </Button>
                </span>
              </div>
              <div className="aw-ed-grid">
                <TextField label="賞の名前" value={aw.name} maxLength={20} placeholder="例：夢中大賞" onChange={(e) => setAward(i, { name: e.target.value })} />
                <TextField label="ひとこと（なくてもよい）" value={aw.note} maxLength={60} placeholder="例：いちばん心に残った出し物" onChange={(e) => setAward(i, { note: e.target.value })} />
              </div>
              <h3>受賞するお店</h3>
              {aw.winners.length === 0 && <p className="st-muted">まだ選んでいません</p>}
              <ul className="aw-ed-winners">
                {aw.winners.map((w, k) => {
                  const s = shopOf.get(w.shop);
                  return (
                    <li key={w.shop} className={s ? `tone-${s.color}` : undefined}>
                      <div className="aw-ed-wtop">
                        <strong>{s ? `${s.dept} ・ ${s.name}` : "（消えたお店）"}</strong>
                        <Button size="sm" variant="danger" icon="消す" onClick={() => setAward(i, { winners: aw.winners.filter((_, x) => x !== k) })}>
                          外す
                        </Button>
                      </div>
                      <TextArea
                        label="講評（なくてもよい）"
                        rows={2}
                        maxLength={120}
                        value={w.comment}
                        onChange={(e) => setAward(i, { winners: aw.winners.map((x, y) => (y === k ? { ...x, comment: e.target.value } : x)) })}
                      />
                    </li>
                  );
                })}
              </ul>
              <label className="aw-ed-add">
                <span>お店を足す</span>
                <select
                  value=""
                  onChange={(e) => e.target.value && setAward(i, { winners: [...aw.winners, { shop: e.target.value, comment: "" }] })}
                >
                  <option value="">選んでください</option>
                  {ranking
                    .filter((s) => !chosen.has(s.id))
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.dept} ・ {s.name}（印象に残った {counts[s.id] ?? 0}）
                      </option>
                    ))}
                </select>
              </label>
              <div className="aw-ed-foot">
                <Button
                  variant="danger"
                  icon="消す"
                  onClick={() => {
                    if (window.confirm(`「${aw.name || `賞 ${i + 1}`}」を消しますか？（保存するまで残ります）`)) change({ ...a, awards: a.awards.filter((_, x) => x !== i) });
                  }}
                >
                  この賞を消す
                </Button>
              </div>
            </section>
          );
        })}

        <div>
          <Button icon="足す" onClick={addAward}>
            賞を足す
          </Button>
        </div>

        <div className="aw-ed-save">
          <Button variant="primary" size="lg" onClick={() => save()} pending={pending} disabled={!ready}>
            保存する
          </Button>
          <span className="st-saved" role="status" aria-live="polite">
            {dirty ? "まだ保存していない変更があります" : msg}
          </span>
          {error && (
            <p className="st-err" role="alert">
              {error}
            </p>
          )}
          {!ready && <p className="st-muted">保存先（Upstash）がつながっていないので、保存できません</p>}
        </div>
      </div>

      <aside className="aw-ed-side aw-ed-card" aria-label="参考：アンケートで印象に残った数">
        <h2>参考：アンケート</h2>
        <p className="st-muted">「印象に残ったお店・出し物」の数（回答 {total} 件・多い順）</p>
        <ol className="aw-ed-rank">
          {ranking.map((s) => (
            <li key={s.id} className={`tone-${s.color}`}>
              <span className="aw-ed-rank-name">
                <small>{s.dept}</small>
                {s.name}
              </span>
              <span className="aw-ed-rank-n">{counts[s.id] ?? 0}</span>
            </li>
          ))}
        </ol>
      </aside>
    </div>
  );
}
