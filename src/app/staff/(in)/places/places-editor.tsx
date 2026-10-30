"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SchoolMap, type MapBase, type MapPin } from "@/components/map/school-map";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Checkbox, Select, TextField } from "@/components/ui/field";
import { areaName, areaOf, OUTSIDE, PLACE_KINDS, placeKindOf, type Area, type Place, type PlaceKind } from "@/lib/types";
import { savedAt, send, slug } from "../../_lib/client";
import { useUnsavedGuard } from "../shops/[id]/use-unsaved-guard";

/** 直している途中のピン。key は画面の中だけの名前（新しいピンは、英字の名前が空のままでもよい） */
type Draft = Place & { key: string; isNew?: boolean };
type Spot = { x: number; y: number };

const KIND = new Map(PLACE_KINDS.map((k) => [k.value, k]));
const kindOf = (p: Pick<Place, "kind">) => KIND.get(placeKindOf(p)) ?? PLACE_KINDS[0];
/** 位置・大きさは 0〜100 の、小数 1 けたまで */
const clamp = (v: number) => Math.min(100, Math.max(0, Math.round(v * 10) / 10));
/** 部屋の四角か（幅と高さがどちらもある） */
const isBox = (p: Pick<Place, "w" | "h">) => !!p.w && !!p.h;
/** 保存してあるピンと同じか（名前・種類・面・位置・大きさ・ひとこと） */
const samePlace = (a: Place, b: Place | undefined) =>
  !!b &&
  a.name === b.name &&
  a.x === b.x &&
  a.y === b.y &&
  a.note === b.note &&
  placeKindOf(a) === placeKindOf(b) &&
  areaOf(a) === areaOf(b) &&
  (a.w ?? 0) === (b.w ?? 0) &&
  (a.h ?? 0) === (b.h ?? 0);

/**
 * 地図のピンを置く・直す（実行委員だけ）。上のボタンで「外」と建物の中のフロアを切り替える。
 * 地図に触っただけではピンは動かない：地図で場所を押す →［ここに動かす］で動く（キーボードなら位置の数や ←↑↓→ のボタンで）。
 * フロアの部屋は「四角で描く」にすると、幅と高さのある四角になる（お客さんの地図では、押すとその部屋のお店が出る）。
 */
export function PlacesEditor({ places: initial, areas: initialAreas, counts }: { places: Place[]; areas: Area[]; counts: Record<string, number> }) {
  const router = useRouter();
  const [places, setPlaces] = useState<Draft[]>(() => initial.map((p) => ({ ...p, key: p.id })));
  // 保存してある値（変えたかどうか・消すときの名前に使う）
  const [saved, setSaved] = useState<Record<string, Place>>(() => Object.fromEntries(initial.map((p) => [p.id, p])));
  const [areas, setAreas] = useState<Area[]>(initialAreas);
  const [area, setArea] = useState<string>(OUTSIDE);
  const [sel, setSel] = useState<string | null>(null);
  // 地図で押した所（まだ動かしていない）
  const [spot, setSpot] = useState<Spot | null>(null);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const cur = places.find((p) => p.key === sel) ?? null;
  const dirtyOf = (p: Draft) => !!p.isNew || !samePlace(p, saved[p.id]);
  useUnsavedGuard(places.some(dirtyOf));

  const curArea = areas.find((a) => a.id === area);
  const base: MapBase = curArea ? { kind: "floor", plan: curArea.plan, name: areaName(curArea) } : { kind: "outside" };
  const areaLabel = (id: string) => {
    const a = areas.find((x) => x.id === id);
    return a ? areaName(a) : "外";
  };

  const update = (patch: Partial<Draft>) => {
    setPlaces((list) => list.map((p) => (p.key === sel ? { ...p, ...patch } : p)));
    setMsg("");
  };
  function choose(key: string) {
    setSel(key);
    setError("");
  }
  function switchArea(id: string) {
    setArea(id);
    setSpot(null);
    // 選んでいるピンがほかの面なら、選ぶのをやめる
    if (cur && areaOf(cur) !== id) setSel(null);
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
    const p: Draft = {
      key: `new-${n}`,
      id: "",
      name: "",
      kind: "spot",
      x: at?.x ?? 50,
      y: at?.y ?? 50,
      note: "",
      isNew: true,
      ...(area !== OUTSIDE ? { area, w: 12, h: 18 } : {}),
    };
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
    const r = await send<{ place: Place }>(`/api/staff/places/${id}`, "PUT", {
      kind: placeKindOf(cur),
      area: areaOf(cur),
      w: isBox(cur) ? cur.w : 0,
      h: isBox(cur) ? cur.h : 0,
      name: cur.name,
      x: cur.x,
      y: cur.y,
      note: cur.note,
    });
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

  const inArea = places.filter((p) => areaOf(p) === area);
  const pins: MapPin[] = inArea.map((p) => {
    const k = kindOf(p);
    return {
      id: p.key,
      name: `${k.mark && !isBox(p) ? `${k.mark} ` : ""}${p.name || "（名前なし）"}`,
      x: p.x,
      y: p.y,
      count: counts[p.id],
      tone: k.value === "spot" ? undefined : "st-pin-facility",
      ...(isBox(p) ? { w: p.w, h: p.h } : {}),
    };
  });
  if (spot) pins.push({ id: "__spot", name: cur ? "ここ？" : "ここに足す？", x: spot.x, y: spot.y, tone: "st-pin-spot" });
  const curName = cur ? cur.name || "新しいピン" : "";
  const delName = cur ? (cur.isNew ? cur.name : saved[cur.id]?.name) || "新しいピン" : "";

  return (
    <div className="st-stack">
      <div className="st-areas" role="group" aria-label="外・フロアの切り替え">
        {[{ id: OUTSIDE, name: "外" }, ...areas.map((a) => ({ id: a.id, name: areaName(a) }))].map((t) => (
          <Button key={t.id} size="sm" variant={area === t.id ? "primary" : "secondary"} aria-pressed={area === t.id} onClick={() => switchArea(t.id)}>
            {t.name}
            <span className="st-area-n">{places.filter((p) => areaOf(p) === t.id).length}</span>
          </Button>
        ))}
      </div>

      <SchoolMap
        pins={pins}
        selected={sel}
        base={base}
        onSelect={(id) => id !== "__spot" && choose(id)}
        onPick={(x, y) => {
          setSpot({ x, y });
          setMsg("");
        }}
        label={`ピンを置く地図（${areaLabel(area)}）`}
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
                  {area === OUTSIDE ? "ここにピンを足す" : "ここに部屋（四角）を足す"}
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
      <div className="st-row" role="group" aria-label={`ピンの一覧（${areaLabel(area)}）`}>
        {inArea.map((p) => {
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
          {area === OUTSIDE ? "ピンを足す" : "部屋・ピンを足す"}
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
            <TextField label="場所の名前" value={cur.name} maxLength={30} onChange={(e) => update({ name: e.target.value })} placeholder="例：201 小講義室、中庭のテント" />
            <Select
              label="ピンの種類"
              value={placeKindOf(cur)}
              onChange={(e) => update({ kind: e.target.value as PlaceKind })}
              options={PLACE_KINDS.map((k) => ({ value: k.value, label: k.mark ? `${k.label}（${k.mark}）` : k.label }))}
              hint="お店・出し物のほかに、トイレ・受付・救護、外の地図の建物（中のフロアへ）も置けます"
            />
            <Select
              label="どこに置くか"
              value={areaOf(cur)}
              onChange={(e) => {
                const next = e.target.value;
                update({ area: next === OUTSIDE ? undefined : next });
                setArea(next);
              }}
              options={[{ value: OUTSIDE, label: "外" }, ...areas.map((a) => ({ value: a.id, label: areaName(a) }))]}
              hint="ほかのフロアへ移すときは、ここを変えてから位置を直します"
            />
            <TextField label="ひとこと（地図で押したときに出る）" value={cur.note} maxLength={60} onChange={(e) => update({ note: e.target.value })} />
            {placeKindOf(cur) === "building" && (
              <p className="st-muted st-span2">
                建物のピンを押すと、名前が同じ建物のフロア（{areas.filter((a) => a.building === cur.name).map((a) => a.floor).join("・") || "まだありません"}）へ移れます。フロアの「建物の名前」と同じ名前にしてください。
              </p>
            )}
            <div className="st-span2">
              <Checkbox
                label="四角で描く（部屋）"
                hint="フロアの部屋・ホールなどは四角にすると、お客さんが部屋ごと押せます"
                checked={isBox(cur)}
                onChange={(e) => update(e.target.checked ? { w: cur.w || 12, h: cur.h || 18 } : { w: undefined, h: undefined })}
              />
            </div>
            <fieldset className="st-span2 st-place-pos">
              <legend>位置（地図の左上から。真ん中の位置です。数を直すか、矢印で少しずつ動かせます）</legend>
              <TextField label="左から（%）" type="number" inputMode="decimal" min={0} max={100} step={0.5} value={cur.x} onChange={(e) => update({ x: clamp(Number(e.target.value) || 0) })} />
              <TextField label="上から（%）" type="number" inputMode="decimal" min={0} max={100} step={0.5} value={cur.y} onChange={(e) => update({ y: clamp(Number(e.target.value) || 0) })} />
              {isBox(cur) && (
                <>
                  <TextField label="幅（%）" type="number" inputMode="decimal" min={1} max={100} step={0.5} value={cur.w} onChange={(e) => update({ w: Math.max(1, clamp(Number(e.target.value) || 1)) })} />
                  <TextField label="高さ（%）" type="number" inputMode="decimal" min={1} max={100} step={0.5} value={cur.h} onChange={(e) => update({ h: Math.max(1, clamp(Number(e.target.value) || 1)) })} />
                </>
              )}
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

      <FloorsCard
        areas={areas}
        current={curArea ?? null}
        placesIn={(id) => places.filter((p) => areaOf(p) === id && !p.isNew).length}
        onSaved={(a) => {
          setAreas((list) => [...list.filter((x) => x.id !== a.id), a].sort((x, y) => x.order - y.order));
          setArea(a.id);
          router.refresh();
        }}
        onRemoved={(id) => {
          setAreas((list) => list.filter((x) => x.id !== id));
          setArea(OUTSIDE);
          router.refresh();
        }}
      />
    </div>
  );
}

/** フロアを足す・名前を直す・消す。見取り図（2〜4 階）は、はじめに入れた物をそのまま使う */
function FloorsCard({
  areas,
  current,
  placesIn,
  onSaved,
  onRemoved,
}: {
  areas: Area[];
  current: Area | null;
  placesIn: (id: string) => number;
  onSaved: (a: Area) => void;
  onRemoved: (id: string) => void;
}) {
  const [building, setBuilding] = useState(current?.building ?? areas[0]?.building ?? "");
  const [floor, setFloor] = useState(current?.floor ?? "");
  const [order, setOrder] = useState(current?.order ?? (areas.at(-1)?.order ?? 0) + 1);
  const [editing, setEditing] = useState<string | null>(current?.id ?? null);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  // 選んでいるフロアが変わったら、欄をそのフロアの値に（新しく足すときは空に）
  const target = current?.id ?? null;
  if (editing !== target) {
    setEditing(target);
    setBuilding(current?.building ?? areas[0]?.building ?? "");
    setFloor(current?.floor ?? "");
    setOrder(current?.order ?? (areas.at(-1)?.order ?? 0) + 1);
    setMsg("");
    setError("");
  }

  async function save() {
    if (!building.trim() || !floor.trim()) return setError("建物の名前と階を入れてください");
    let id = current?.id;
    if (!id) {
      let n = areas.length + 1;
      while (areas.some((a) => a.id === `floor-${n}`)) n++;
      id = `floor-${n}`;
    }
    setPending(true);
    setError("");
    const r = await send<{ area: Area }>(`/api/staff/areas/${id}`, "PUT", { building: building.trim(), floor: floor.trim(), order: Number(order) || 0 });
    setPending(false);
    if (!r.ok) return setError(r.error);
    setMsg(`「${areaName(r.area)}」を${savedAt()}`);
    onSaved(r.area);
  }

  async function remove() {
    if (!current) return;
    const r = await send(`/api/staff/areas/${current.id}`, "DELETE");
    if (!r.ok) return setError(r.error);
    onRemoved(current.id);
  }

  const n = current ? placesIn(current.id) : 0;
  return (
    <Card title={current ? `フロアの設定（${areaName(current)}）` : "フロアを足す"}>
      <p className="st-muted">
        {current
          ? current.plan
            ? "このフロアには見取り図があります。部屋の四角は、上の地図で選んで直せます。"
            : "このフロアには見取り図がありません。方眼の上に、部屋の四角やピンを置いてください。"
          : "建物の中のフロアを足すと、お客さんの地図の上のボタンに出ます（見取り図は無く、方眼の上に部屋の四角を置きます）。"}
      </p>
      <form
        className="st-form-grid"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <TextField label="建物の名前" value={building} maxLength={20} onChange={(e) => setBuilding(e.target.value)} placeholder="例：知育館" />
        <TextField label="階" value={floor} maxLength={12} onChange={(e) => setFloor(e.target.value)} placeholder="例：2階" />
        <TextField label="並び順（小さいほど前）" type="number" inputMode="numeric" min={0} max={9999} value={order} onChange={(e) => setOrder(Number(e.target.value) || 0)} />
        <div className="st-row st-span2">
          <Button type="submit" variant="primary" pending={pending}>
            {current ? "フロアを保存" : "フロアを足す"}
          </Button>
          {current && (
            <ConfirmDialog title={`「${areaName(current)}」を消しますか？`} confirmLabel="消す" triggerLabel="このフロアを消す" triggerIcon="消す" onConfirm={remove}>
              {n ? `このフロアにはピンが ${n} 個あります。先にピンを消すか、ほかのフロアへ移してください（このままでは消せません）。` : "元に戻せません。"}
            </ConfirmDialog>
          )}
        </div>
        <p className="st-saved st-span2" role="status" aria-live="polite">
          {msg}
        </p>
        {error && (
          <p className="st-err st-span2" role="alert">
            {error}
          </p>
        )}
      </form>
    </Card>
  );
}
