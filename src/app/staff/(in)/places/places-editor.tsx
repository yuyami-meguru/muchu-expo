"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SchoolMap } from "@/components/map/school-map";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TextField } from "@/components/ui/field";
import type { Place } from "@/lib/types";
import { savedAt, send, slug } from "../../_lib/client";

type Draft = Place & { isNew?: boolean };

export function PlacesEditor({ places: initial, counts }: { places: Place[]; counts: Record<string, number> }) {
  const router = useRouter();
  const [places, setPlaces] = useState<Draft[]>(initial);
  const [sel, setSel] = useState<string | null>(initial[0]?.id ?? null);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const cur = places.find((p) => p.id === sel) ?? null;
  const update = (patch: Partial<Draft>) => setPlaces((list) => list.map((p) => (p.id === sel ? { ...p, ...patch } : p)));

  async function save() {
    if (!cur) return;
    const id = slug(cur.id);
    if (!id) return setError("英字の名前（a〜z・数字・-）を入れてください");
    if (!cur.name.trim()) return setError("場所の名前を入れてください");
    if (cur.isNew && initial.some((p) => p.id === id)) return setError("その英字の名前はもう使われています");
    setPending(true);
    setError("");
    const r = await send(`/api/staff/places/${id}`, "PUT", { name: cur.name, x: cur.x, y: cur.y, note: cur.note });
    setPending(false);
    if (!r.ok) return setError(r.error);
    setPlaces((list) => list.map((p) => (p.id === sel ? { ...p, id, isNew: false } : p)));
    setSel(id);
    setMsg(`「${cur.name}」を${savedAt()}`);
    router.refresh();
  }

  async function remove() {
    if (!cur) return;
    if (!cur.isNew) {
      if (counts[cur.id] && !window.confirm(`このピンには ${counts[cur.id]} 店がつながっています。消すと、そのお店の場所は「未定」になります。消しますか？`)) return;
      const r = await send(`/api/staff/places/${cur.id}`, "DELETE");
      if (!r.ok) return setError(r.error);
    }
    const rest = places.filter((p) => p.id !== cur.id);
    setPlaces(rest);
    setSel(rest[0]?.id ?? null);
    setMsg("消しました");
    router.refresh();
  }

  function add() {
    let n = 1;
    while (places.some((p) => p.id === `place-${n}`)) n++;
    const p: Draft = { id: `place-${n}`, name: "", x: 50, y: 50, note: "", isNew: true };
    setPlaces((list) => [...list, p]);
    setSel(p.id);
    setError("");
  }

  return (
    <div className="st-stack">
      <SchoolMap
        pins={places.map((p) => ({ id: p.id, name: p.name || "（名前なし）", x: p.x, y: p.y, count: counts[p.id] }))}
        selected={sel}
        onSelect={setSel}
        onPick={(x, y) => cur && update({ x, y })}
        label="ピンを置く地図"
      />
      <p className="st-place-pick" aria-live="polite">
        {cur ? `「${cur.name || "新しいピン"}」を選んでいます。地図を押すと動きます（保存を押すまで残りません）` : "ピンを選ぶか、足してください"}
      </p>
      <div className="st-row">
        {places.map((p) => (
          <Button key={p.id} size="sm" variant={p.id === sel ? "primary" : "secondary"} onClick={() => setSel(p.id)}>
            {p.name || "（名前なし）"}
          </Button>
        ))}
        <Button size="sm" icon="足す" onClick={add}>
          ピンを足す
        </Button>
      </div>

      {cur && (
        <Card title={cur.isNew ? "新しいピン" : "選んでいるピン"}>
          <form
            className="st-form-grid"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            <TextField label="場所の名前" value={cur.name} maxLength={30} onChange={(e) => update({ name: e.target.value })} placeholder="例：中庭のテント" />
            <TextField
              label="英字の名前"
              value={cur.id}
              maxLength={40}
              disabled={!cur.isNew}
              hint={cur.isNew ? "a〜z・数字・- だけ。あとで変えられません" : "変えられません"}
              onChange={(e) => {
                const id = e.target.value;
                setPlaces((list) => list.map((p) => (p.id === sel ? { ...p, id } : p)));
                setSel(id);
              }}
            />
            <TextField className="st-span2" label="ひとこと（地図で押したときに出る）" value={cur.note} maxLength={60} onChange={(e) => update({ note: e.target.value })} />
            <p className="st-muted st-span2">
              位置：左から {cur.x}% ・ 上から {cur.y}%
            </p>
            <div className="st-row st-span2">
              <Button type="submit" variant="primary" pending={pending}>
                保存
              </Button>
              <Button variant="danger" icon="消す" onClick={remove}>
                このピンを消す
              </Button>
              <span className="st-saved" role="status" aria-live="polite">
                {msg}
              </span>
            </div>
            {error && (
              <p className="st-err st-span2" role="alert">
                {error}
              </p>
            )}
          </form>
        </Card>
      )}
    </div>
  );
}
