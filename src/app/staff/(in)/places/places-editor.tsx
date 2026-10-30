"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SchoolMap, type MapPin } from "@/components/map/school-map";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Select, TextField } from "@/components/ui/field";
import { PLACE_KINDS, placeKindOf, type Place, type PlaceKind } from "@/lib/types";
import { savedAt, send, slug } from "../../_lib/client";
import { useUnsavedGuard } from "../shops/[id]/use-unsaved-guard";

/** 直している途中のピン。key は画面の中だけの名前（新しいピンは、英字の名前が空のままでもよい） */
type Draft = Place & { key: string; isNew?: boolean };
type Spot = { x: number; y: number };

const KIND = new Map(PLACE_KINDS.map((k) => [k.value, k]));
const kindOf = (p: Pick<Place, "kind">) => KIND.get(placeKindOf(p)) ?? PLACE_KINDS[0];
/** 位置は 0〜100 の、小数 1 けたまで */
const clamp = (v: number) => Math.min(100, Math.max(0, Math.round(v * 10) / 10));
/** 保存してあるピンと同じか（名前・種類・位置・ひとこと） */
const samePlace = (a: Place, b: Place | undefined) =>
  !!b && a.name === b.name && a.x === b.x && a.y === b.y && a.note === b.note && placeKindOf(a) === placeKindOf(b);

/**
 * 地図のピンを置く・直す（実行委員だけ）。
 * 地図に触っただけではピンは動かない：地図で場所を押す →［ここに動かす］で動く（キーボードなら位置の数や ←↑↓→ のボタンで）。
 */
export function PlacesEditor({ places: initial, counts }: { places: Place[]; counts: Record<string, number> }) {
  const router = useRouter();
  const [places, setPlaces] = useState<Draft[]>(() => initial.map((p) => ({ ...p, key: p.id })));
  // 保存してある値（変えたかどうか・消すときの名前に使う）
  const [saved, setSaved] = useState<Record<string, Place>>(() => Object.fromEntries(initial.map((p) => [p.id, p])));
  const [sel, setSel] = useState<string | null>(null);
  // 地図で押した所（まだ動かしていない）
  const [spot, setSpot] = useState<Spot | null>(null);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const cur = places.find((p) => p.key === sel) ?? null;
  const dirtyOf = (p: Draft) => !!p.isNew || !samePlace(p, saved[p.id]);
  useUnsavedGuard(places.some(dirtyOf));

  const update = (patch: Partial<Draft>) => {
    setPlaces((list) => list.map((p) => (p.key === sel ? { ...p, ...patch } : p)));
    setMsg("");
  };
  function choose(key: string) {
    setSel(key);
    setError("");
  }
  function moveHere() {
    if (!cur || !spot) return;
    update(spot);
    setSpot(null);
  }
  function nudge(dx: number, dy: number) {
    if (cur) update({ x: clamp(cur.x + dx), y: clamp(cur.y + dy) });
  }

  function add(at?: Spot) {
    let n = 1;
    while (places.some((p) => p.key === `new-${n}`)) n++;
    const p: Draft = { key: `new-${n}`, id: "", name: "", kind: "spot", x: at?.x ?? 50, y: at?.y ?? 50, note: "", isNew: true };
    setPlaces((list) => [...list, p]);
    setSel(p.key);
    setSpot(null);
    setError("");
    setMsg("");
  }

  /** 自動の英字の名前（place-5 など）。いまあるピンの数と、place-○ の番号のうち大きいほうの次 */
  function autoId() {
    const ids = [...Object.keys(saved), ...places.map((p) => p.id)].filter(Boolean);
    const nums = ids.map((x) => /^place-(\d+)$/.exec(x)?.[1]).filter(Boolean).map(Number);
    return `place-${Math.max(Object.keys(saved).length, ...nums) + 1}`;
  }

  async function save() {
    if (!cur) return;
    if (!cur.name.trim()) return setError("場所の名前を入れてください");
    // 英字の名前：空や日本語なら止めずに自動で付ける
    const id = cur.isNew ? slug(cur.id) || autoId() : cur.id;
    if (cur.isNew && (saved[id] || places.some((p) => p.key !== cur.key && p.id === id))) {
      return setError("その英字の名前はもう使われています。空にすると自動で付けます");
    }
    const key = cur.key;
    setPending(true);
    setError("");
    const r = await send<{ place: Place }>(`/api/staff/places/${id}`, "PUT", { kind: placeKindOf(cur), name: cur.name, x: cur.x, y: cur.y, note: cur.note });
    setPending(false);
    if (!r.ok) return setError(r.error);
    setPlaces((list) => list.map((p) => (p.key === key ? { ...r.place, key: r.place.id } : p)));
    setSaved((s) => ({ ...s, [r.place.id]: r.place }));
    setSel(r.place.id);
    setMsg(`「${r.place.name}」を${savedAt()}`);
    router.refresh();
  }

  async function remove() {
    if (!cur) return;
    const target = cur;
    const name = (target.isNew ? target.name : saved[target.id]?.name) || "新しいピン";
    if (!target.isNew) {
      const r = await send(`/api/staff/places/${target.id}`, "DELETE");
      if (!r.ok) return setError(r.error);
      setSaved((s) => Object.fromEntries(Object.entries(s).filter(([id]) => id !== target.id)));
    }
    setPlaces((list) => list.filter((p) => p.key !== target.key));
    setSel(null);
    setError("");
    setMsg(`「${name}」のピンを消しました`);
    router.refresh();
  }

  const pins: MapPin[] = places.map((p) => {
    const k = kindOf(p);
    return {
      id: p.key,
      name: `${k.mark ? `${k.mark} ` : ""}${p.name || "（名前なし）"}`,
      x: p.x,
      y: p.y,
      count: counts[p.id],
      tone: k.value === "spot" ? undefined : "st-pin-facility",
    };
  });
  if (spot) pins.push({ id: "__spot", name: cur ? "ここ？" : "ここに足す？", x: spot.x, y: spot.y, tone: "st-pin-spot" });
  const curName = cur ? cur.name || "新しいピン" : "";
  const delName = cur ? (cur.isNew ? cur.name : saved[cur.id]?.name) || "新しいピン" : "";

  return (
    <div className="st-stack">
      <SchoolMap
        pins={pins}
        selected={sel}
        onSelect={(id) => id !== "__spot" && choose(id)}
        onPick={(x, y) => {
          setSpot({ x, y });
          setMsg("");
        }}
        label="ピンを置く地図"
      />
      <div className="st-place-bar" aria-live="polite">
        {spot ? (
          <>
            <p className="st-place-pick">{cur ? `地図の「ここ？」の所へ、「${curName}」を動かしますか？` : "地図の「ここに足す？」の所に、新しいピンを置きますか？"}</p>
            <div className="st-row">
              {cur ? (
                <Button size="sm" icon="場所" onClick={moveHere}>
                  ここに動かす
                </Button>
              ) : (
                <Button size="sm" icon="足す" onClick={() => add(spot)}>
                  ここにピンを足す
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => setSpot(null)}>
                やめる
              </Button>
            </div>
          </>
        ) : (
          <p className="st-place-pick">
            {cur
              ? `「${curName}」を選んでいます。動かすときは、地図で場所を押してから［ここに動かす］を押してください（保存を押すまで残りません）`
              : "直すピンを、地図か下の一覧から選んでください。新しく置くときは、地図で場所を押すか［ピンを足す］を押します"}
          </p>
        )}
      </div>

      <p className="st-saved" role="status" aria-live="polite">
        {msg}
      </p>
      <div className="st-row" role="group" aria-label="ピンの一覧">
        {places.map((p) => {
          const k = kindOf(p);
          return (
            <Button key={p.key} size="sm" variant={p.key === sel ? "primary" : "secondary"} aria-pressed={p.key === sel} onClick={() => choose(p.key)}>
              {k.mark && (
                <span className="st-pin-mark" aria-hidden="true">
                  {k.mark}
                </span>
              )}
              {k.value !== "spot" && <span className="sr-only">{k.label}：</span>}
              {p.name || "（名前なし）"}
              {dirtyOf(p) && <span className="st-pin-unsaved">未保存</span>}
            </Button>
          );
        })}
        <Button size="sm" icon="足す" onClick={() => add()}>
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
            <Select
              label="ピンの種類"
              value={placeKindOf(cur)}
              onChange={(e) => update({ kind: e.target.value as PlaceKind })}
              options={PLACE_KINDS.map((k) => ({ value: k.value, label: k.mark ? `${k.label}（${k.mark}）` : k.label }))}
              hint="お店・出し物のほかに、トイレ・受付・救護なども置けます"
            />
            <TextField className="st-span2" label="ひとこと（地図で押したときに出る）" value={cur.note} maxLength={60} onChange={(e) => update({ note: e.target.value })} />
            <fieldset className="st-span2 st-place-pos">
              <legend>位置（地図の左上から。数を直すか、矢印で少しずつ動かせます）</legend>
              <TextField label="左から（%）" type="number" inputMode="decimal" min={0} max={100} step={0.5} value={cur.x} onChange={(e) => update({ x: clamp(Number(e.target.value) || 0) })} />
              <TextField label="上から（%）" type="number" inputMode="decimal" min={0} max={100} step={0.5} value={cur.y} onChange={(e) => update({ y: clamp(Number(e.target.value) || 0) })} />
              <div className="st-place-nudge" role="group" aria-label="ピンを少しずつ動かす">
                <Button size="sm" onClick={() => nudge(-1, 0)} aria-label="左へ少し動かす">
                  ← 左
                </Button>
                <Button size="sm" onClick={() => nudge(0, -1)} aria-label="上へ少し動かす">
                  ↑ 上
                </Button>
                <Button size="sm" onClick={() => nudge(0, 1)} aria-label="下へ少し動かす">
                  ↓ 下
                </Button>
                <Button size="sm" onClick={() => nudge(1, 0)} aria-label="右へ少し動かす">
                  → 右
                </Button>
              </div>
            </fieldset>
            <details className="st-span2 st-more-opt">
              <summary>英字の名前（空でよい・自動で付けます）</summary>
              {cur.isNew ? (
                <TextField
                  label="英字の名前"
                  value={cur.id}
                  maxLength={40}
                  placeholder="空なら place-5 のように自動"
                  hint="a〜z・数字・- だけ。あとで変えられません"
                  onChange={(e) => update({ id: e.target.value })}
                />
              ) : (
                <p className="st-muted">{cur.id}（あとから変えられません）</p>
              )}
            </details>
            <div className="st-row st-span2">
              <Button type="submit" variant="primary" pending={pending}>
                保存
              </Button>
              <ConfirmDialog
                title={cur.isNew ? `「${delName}」を消しますか？` : `「${delName}」のピンを消しますか？`}
                confirmLabel="消す"
                triggerLabel="このピンを消す"
                triggerIcon="消す"
                onConfirm={remove}
              >
                {cur.isNew ? "まだ保存していないピンです。" : "元に戻せません。"}
                {counts[cur.id] ? `このピンには ${counts[cur.id]} 店がつながっています。消すと、そのお店の場所は「未定」になります。` : ""}
              </ConfirmDialog>
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
