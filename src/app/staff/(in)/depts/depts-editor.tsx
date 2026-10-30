"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { TextField } from "@/components/ui/field";
import { TONES, type Dept, type Tone } from "@/lib/types";
import { savedAt, send } from "../../_lib/client";
import { noteAuth } from "../_components/session-signal";
import { failMsg } from "../ops-result";
import { useUnsavedGuard } from "../shops/[id]/use-unsaved-guard";

type Draft = Dept & { isNew?: boolean; dirty?: boolean };

const bodyOf = (d: Dept) => ({ name: d.name.trim(), short: d.short.trim(), tagline: d.tagline.trim(), color: d.color, order: d.order });

/**
 * 部門の一覧。1 つずつカードで直して「保存」。並び順は ↑↓ で（押すとすぐ保存。並び順だけが変わり、書きかけの名前・色は送らない）。
 * 保存・並び順の結果は、そのカードの中（ボタンのそば）に出す（画面の上に出すと、下の部門では見えないため）。消したときだけ上に出す
 */
export function DeptsEditor({ depts: initial, shopsIn }: { depts: Dept[]; shopsIn: Record<string, string[]> }) {
  const router = useRouter();
  const [list, setList] = useState<Draft[]>(initial);
  // 保存してある値（↑↓ では、これに並び順だけを変えて送る）
  const [saved, setSaved] = useState<Record<string, Dept>>(() => Object.fromEntries(initial.map((d) => [d.id, d])));
  const [msg, setMsg] = useState("");
  /** カードの中に出す結果（部門 id → 文） */
  const [done, setDone] = useState<{ id: string; text: string } | null>(null);
  const [error, setError] = useState<{ id: string; text: string } | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  useUnsavedGuard(list.some((d) => d.dirty));

  const update = (id: string, patch: Partial<Draft>) => setList((l) => l.map((d) => (d.id === id ? { ...d, ...patch, dirty: true } : d)));

  async function save(d: Draft) {
    if (!d.name.trim()) return setError({ id: d.id, text: "部門の名前を入れてください" });
    if (!d.short.trim()) return setError({ id: d.id, text: "短い名前（カードや地図に出る 8 文字まで）を入れてください" });
    setPending(d.id);
    setError(null);
    setDone(null);
    const body = bodyOf(d);
    const r = noteAuth(await send(`/api/staff/depts/${d.id}`, "PUT", body));
    setPending(null);
    if (!r.ok) return setError({ id: d.id, text: failMsg("保存", r, "少し待ってから、もう一度［保存］を押してください") });
    setList((l) => l.map((x) => (x.id === d.id ? { ...x, isNew: false, dirty: false } : x)));
    setSaved((s) => ({ ...s, [d.id]: { id: d.id, ...body } }));
    setDone({ id: d.id, text: `「${d.name}」を${savedAt()}` });
    router.refresh();
  }

  async function remove(d: Draft) {
    if (!d.isNew) {
      const r = noteAuth(await send(`/api/staff/depts/${d.id}`, "DELETE"));
      if (!r.ok) return setError({ id: d.id, text: failMsg("この部門を消すことが", r, "この画面を読み込み直して、消えているか確かめてください") });
      setSaved((s) => Object.fromEntries(Object.entries(s).filter(([id]) => id !== d.id)));
    }
    setList((l) => l.filter((x) => x.id !== d.id));
    setMsg(`「${(d.isNew ? d.name : saved[d.id]?.name) || "新しい部門"}」を消しました`);
    router.refresh();
  }

  /** ↑↓：並び順を 10・20・30… に付け直して、変わった部門の並び順だけを保存する（名前・色などは保存してある値のまま） */
  async function move(i: number, dir: -1 | 1) {
    // 送っているあいだは何もしない（ボタンは disabled にせず「押せない」印だけ。押したボタンから、キーボードで選んでいた所が消えないように）
    if (pending) return;
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    const renum = next.map((d, k) => ({ ...d, order: (k + 1) * 10 }));
    setList(renum);
    setError(null);
    setDone(null);
    const moved = next[j];
    const changed = renum.filter((d) => !d.isNew && saved[d.id] && d.order !== saved[d.id].order);
    setPending("move");
    for (const d of changed) {
      const s = { ...saved[d.id], order: d.order };
      const r = noteAuth(await send(`/api/staff/depts/${d.id}`, "PUT", bodyOf(s)));
      if (!r.ok) {
        setPending(null);
        return setError({ id: d.id, text: failMsg("並び順を保存", r, "この画面を読み込み直して、並び順を確かめてください") });
      }
      setSaved((all) => ({ ...all, [d.id]: s }));
    }
    setPending(null);
    setDone({ id: moved.id, text: `並び順を${savedAt()}` });
    router.refresh();
  }

  function add() {
    let n = 1;
    while (list.some((d) => d.id === `dept-${n}`)) n++;
    const used = new Set(list.map((d) => d.color));
    const color: Tone = TONES.find((t) => !used.has(t.value))?.value ?? "brown";
    const order = (Math.max(0, ...list.map((d) => d.order)) || 0) + 10;
    setList((l) => [...l, { id: `dept-${n}`, name: "", short: "", tagline: "", color, order, isNew: true, dirty: true }]);
    setError(null);
  }

  return (
    <div className="st-stack">
      <p className="st-saved" role="status" aria-live="polite">
        {msg}
      </p>
      <ol className="st-depts">
        {list.map((d, i) => {
          const shops = shopsIn[d.id] ?? [];
          const name = (d.isNew ? d.name : saved[d.id]?.name) || "新しい部門";
          return (
            <li key={d.id} className={`st-dept-card tone-${d.color}`}>
              <div className="st-dept-top">
                <span className="st-dept-chip">{d.short || "（短い名前）"}</span>
                <span className="st-muted">{d.isNew ? "まだ保存していません" : shops.length ? `お店 ${shops.length}：${shops.join("・")}` : "お店はまだありません"}</span>
                <span className="st-dept-move">
                  <Button size="sm" variant="ghost" disabled={i === 0} aria-disabled={!!pending || undefined} onClick={() => move(i, -1)} aria-label={`${d.name}を上へ`}>
                    ↑ 上へ
                  </Button>
                  <Button size="sm" variant="ghost" disabled={i === list.length - 1} aria-disabled={!!pending || undefined} onClick={() => move(i, 1)} aria-label={`${d.name}を下へ`}>
                    ↓ 下へ
                  </Button>
                </span>
              </div>
              <form
                className="st-form-grid"
                noValidate
                onSubmit={(e) => {
                  e.preventDefault();
                  save(d);
                }}
              >
                <TextField label="部門の名前" value={d.name} maxLength={20} placeholder="例：体験部門" onChange={(e) => update(d.id, { name: e.target.value })} />
                <TextField label="短い名前（カード・地図）" value={d.short} maxLength={8} placeholder="例：体験" onChange={(e) => update(d.id, { short: e.target.value })} />
                <TextField className="st-span2" label="ひとこと（なくてもよい）" value={d.tagline} maxLength={40} placeholder="例：遊んで、つくって、持って帰れる" onChange={(e) => update(d.id, { tagline: e.target.value })} />
                <fieldset className="st-span2 st-tones">
                  <legend>色</legend>
                  {TONES.map((t) => (
                    <label key={t.value} className={`st-tone tone-${t.value}`}>
                      <input type="radio" name={`tone-${d.id}`} value={t.value} checked={d.color === t.value} onChange={() => update(d.id, { color: t.value })} />
                      <span className="st-tone-sw" aria-hidden="true" />
                      <span className="st-tone-l">{t.label}</span>
                    </label>
                  ))}
                </fieldset>
                <div className="st-row st-span2">
                  <Button type="submit" variant={d.dirty ? "primary" : "secondary"} pending={pending === d.id}>
                    保存
                  </Button>
                  {shops.length > 0 ? (
                    <Button variant="danger" icon="消す" disabled title="お店が入っている部門は消せません。先に「お店の情報」で別の部門へ移してください">
                      この部門を消す
                    </Button>
                  ) : (
                    <ConfirmDialog
                      title={`「${name}」を消しますか？`}
                      confirmLabel="消す"
                      triggerLabel="この部門を消す"
                      triggerIcon="消す"
                      onConfirm={() => remove(d)}
                    >
                      {d.isNew ? "まだ保存していない部門です。" : "元に戻せません。"}
                    </ConfirmDialog>
                  )}
                  {shops.length > 0 && <span className="st-muted">お店を別の部門へ移すと消せます</span>}
                  {d.dirty && !d.isNew && <span className="st-muted">まだ保存していない変更があります</span>}
                </div>
                {error?.id === d.id && (
                  <p className="st-err st-span2" role="alert">
                    {error.text}
                  </p>
                )}
                {done?.id === d.id && !d.dirty && (
                  <p className="st-saved st-span2" role="status">
                    ✓ {done.text}
                  </p>
                )}
              </form>
            </li>
          );
        })}
      </ol>
      <div>
        <Button icon="足す" onClick={add}>
          部門を足す
        </Button>
      </div>
    </div>
  );
}
