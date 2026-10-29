"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { TONES, type Dept, type Tone } from "@/lib/types";
import { savedAt, send } from "../../_lib/client";

type Draft = Dept & { isNew?: boolean; dirty?: boolean };

/** 部門の一覧。1 つずつカードで直して「保存」。並び順は ↑↓ で（押すとすぐ保存） */
export function DeptsEditor({ depts: initial, shopsIn }: { depts: Dept[]; shopsIn: Record<string, string[]> }) {
  const router = useRouter();
  const [list, setList] = useState<Draft[]>(initial);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState<{ id: string; text: string } | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  const update = (id: string, patch: Partial<Draft>) => setList((l) => l.map((d) => (d.id === id ? { ...d, ...patch, dirty: true } : d)));
  const body = (d: Draft) => ({ name: d.name.trim(), short: d.short.trim(), tagline: d.tagline.trim(), color: d.color, order: d.order });

  async function save(d: Draft) {
    if (!d.name.trim()) return setError({ id: d.id, text: "部門の名前を入れてください" });
    if (!d.short.trim()) return setError({ id: d.id, text: "短い名前（カードや地図に出る 8 文字まで）を入れてください" });
    setPending(d.id);
    setError(null);
    const r = await send(`/api/staff/depts/${d.id}`, "PUT", body(d));
    setPending(null);
    if (!r.ok) return setError({ id: d.id, text: r.error });
    setList((l) => l.map((x) => (x.id === d.id ? { ...x, isNew: false, dirty: false } : x)));
    setMsg(`「${d.name}」を${savedAt()}`);
    router.refresh();
  }

  async function remove(d: Draft) {
    if (!d.isNew) {
      if (!window.confirm(`「${d.name}」を消しますか？`)) return;
      const r = await send(`/api/staff/depts/${d.id}`, "DELETE");
      if (!r.ok) return setError({ id: d.id, text: r.error });
    }
    setList((l) => l.filter((x) => x.id !== d.id));
    setMsg(`「${d.name || "新しい部門"}」を消しました`);
    router.refresh();
  }

  /** ↑↓：並び順を 10・20・30… に付け直して、変わった部門だけ保存する */
  async function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    const renum = next.map((d, k) => ({ ...d, order: (k + 1) * 10 }));
    setList(renum);
    setError(null);
    const changed = renum.filter((d) => !d.isNew && d.order !== list.find((x) => x.id === d.id)?.order);
    for (const d of changed) {
      const r = await send(`/api/staff/depts/${d.id}`, "PUT", body(d));
      if (!r.ok) return setError({ id: d.id, text: r.error });
    }
    setMsg(`並び順を${savedAt()}`);
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
          return (
            <li key={d.id} className={`st-dept-card tone-${d.color}`}>
              <div className="st-dept-top">
                <span className="st-dept-chip">{d.short || "（短い名前）"}</span>
                <span className="st-muted">{d.isNew ? "まだ保存していません" : shops.length ? `お店 ${shops.length}：${shops.join("・")}` : "お店はまだありません"}</span>
                <span className="st-dept-move">
                  <Button size="sm" variant="ghost" disabled={i === 0 || !!pending} onClick={() => move(i, -1)} aria-label={`${d.name}を上へ`}>
                    ↑ 上へ
                  </Button>
                  <Button size="sm" variant="ghost" disabled={i === list.length - 1 || !!pending} onClick={() => move(i, 1)} aria-label={`${d.name}を下へ`}>
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
                  <Button
                    variant="danger"
                    icon="消す"
                    disabled={shops.length > 0}
                    onClick={() => remove(d)}
                    title={shops.length ? "お店が入っている部門は消せません。先に「お店の情報」で別の部門へ移してください" : undefined}
                  >
                    この部門を消す
                  </Button>
                  {shops.length > 0 && <span className="st-muted">お店を別の部門へ移すと消せます</span>}
                </div>
                {error?.id === d.id && (
                  <p className="st-err st-span2" role="alert">
                    {error.text}
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
