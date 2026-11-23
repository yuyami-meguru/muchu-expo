"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { OutsideLabels, OutsidePlanSvg } from "@/components/map/outside-plan";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cx } from "@/components/ui/cx";
import { Select, TextArea, TextField } from "@/components/ui/field";
import {
  DEFAULT_LAYOUT,
  OUT_KINDS,
  OUT_MAX,
  OUT_MIN,
  OUT_SHAPES,
  OUT_VIEW,
  type OutItem,
  type OutKind,
  type OutLayout,
  type OutPlace,
  type OutShape,
} from "@/lib/outside-plan";
import { PLACE_KINDS, type PlaceKind } from "@/lib/types";
import { savedAt, send } from "../../_lib/client";
import { useUnsavedGuard } from "../shops/[id]/use-unsaved-guard";
import "@/components/map/school-map.css";

/*
 * 外の会場マップの配置を直す（v0.22.0。ユーザー「配置をマップ上で自由にできたら」）。
 * 枠（大食堂・テント・休憩・受付など）をドラッグで動かす、右下の角をドラッグで大きさを変える、足す・消す、名前・色・形・押したときの場所を変える。
 * ［保存］で配置をまるごと保存する（PUT /api/staff/outmap）。お客さんの地図はこの配置で描き、押せる枠が「外の場所」になる。
 * 道と木は動かない背景。パンフ（印刷物）は自動ではそろわない
 */

/** 小さくしすぎない（パンフの単位） */
const MIN = 16;
/** 矢印のボタン・キーで動かす量（パンフの単位） */
const STEP = 4;
const SIZES = [
  { value: "12", label: "小さい" },
  { value: "15", label: "やや小さい" },
  { value: "19", label: "ふつう" },
  { value: "22", label: "大きい" },
];
const nearestSize = (n: number | undefined) => String([12, 15, 19, 22].reduce((a, b) => (Math.abs(b - (n ?? 19)) < Math.abs(a - (n ?? 19)) ? b : a)));
const pctX = (v: number) => `${(((v - OUT_VIEW.x) / OUT_VIEW.w) * 100).toFixed(3)}%`;
const pctY = (v: number) => `${(((v - OUT_VIEW.y) / OUT_VIEW.h) * 100).toFixed(3)}%`;
const plain = (s: string) => s.replace(/\n/g, "").trim();
const KIND_LABEL = Object.fromEntries(PLACE_KINDS.map((k) => [k.value, k.label])) as Record<PlaceKind, string>;

type Drag = { id: string; mode: "move" | "size"; px: number; py: number; start: OutItem; scale: number; moved: boolean };

export function LayoutEditor({
  layout,
  counts,
  buildings,
  onClose,
}: {
  layout: OutLayout;
  /** 場所の id ごとの、そこにあるお店・出し物の数 */
  counts: Record<string, number>;
  /** フロアの建物の名前（押すと中の地図へ移れる枠に使う） */
  buildings: string[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [items, setItems] = useState<OutItem[]>(() => layout.items);
  const [base, setBase] = useState(() => JSON.stringify(layout.items));
  const [sel, setSel] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const boardRef = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const dirty = JSON.stringify(items) !== base;
  useUnsavedGuard(dirty);
  const draft: OutLayout = { items };
  const cur = items.find((i) => i.id === sel) ?? null;

  /** 選んでいる枠を変える */
  const patch = (p: Partial<OutItem>) => {
    setItems((list) => list.map((i) => (i.id === sel ? { ...i, ...p } : i)));
    setMsg("");
  };
  /** 選んでいる枠の場所を変える（同じ場所の枠もいっしょに。どれを押しても同じ案内が出るように） */
  const patchPlace = (p: Partial<OutPlace>) => {
    const pid = cur?.place?.id;
    if (!pid) return;
    setItems((list) => list.map((i) => (i.place?.id === pid ? { ...i, place: { ...i.place, ...p } } : i)));
    setMsg("");
  };
  /** 場所の id（out-…）。ほかの場所と重ならないように */
  const newPlaceId = (seed: string) => {
    const used = new Set(items.flatMap((i) => (i.place ? [i.place.id] : [])));
    const head = `out-${seed}`.slice(0, 36);
    let id = head;
    for (let n = 2; used.has(id); n++) id = `${head}-${n}`;
    return id;
  };
  const places = [...new Map(items.flatMap((i) => (i.place ? [[i.place.id, i.place] as const] : []))).values()];

  /* ───── ドラッグ（枠を動かす・右下の角で大きさを変える） ───── */
  function start(e: PointerEvent<HTMLElement>, it: OutItem, mode: Drag["mode"]) {
    if (e.button !== 0) return;
    e.stopPropagation();
    const r = boardRef.current?.getBoundingClientRect();
    if (!r?.width) return;
    drag.current = { id: it.id, mode, px: e.clientX, py: e.clientY, start: it, scale: OUT_VIEW.w / r.width, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
    setSel(it.id);
    setMsg("");
  }
  function move(e: PointerEvent<HTMLElement>) {
    const d = drag.current;
    if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.px, e.clientY - d.py) < 3) return;
    d.moved = true;
    const dx = Math.round((e.clientX - d.px) * d.scale);
    const dy = Math.round((e.clientY - d.py) * d.scale);
    const s = d.start;
    const w = s.x2 - s.x1;
    const h = s.y2 - s.y1;
    const next =
      d.mode === "move"
        ? (() => {
            const x1 = Math.min(Math.max(s.x1 + dx, OUT_MIN.x), OUT_MAX.x - w);
            const y1 = Math.min(Math.max(s.y1 + dy, OUT_MIN.y), OUT_MAX.y - h);
            return { x1, y1, x2: x1 + w, y2: y1 + h };
          })()
        : { x2: Math.min(Math.max(s.x2 + dx, s.x1 + MIN), OUT_MAX.x), y2: Math.min(Math.max(s.y2 + dy, s.y1 + MIN), OUT_MAX.y) };
    setItems((list) => list.map((i) => (i.id === d.id ? { ...i, ...next } : i)));
  }
  function end() {
    drag.current = null;
  }

  /** 少しずつ動かす・大きさを変える（ボタンと矢印のキー。Shift＋矢印は大きさ） */
  function nudge(dx: number, dy: number, size = false) {
    if (!cur) return;
    if (size) {
      patch({ x2: Math.min(Math.max(cur.x2 + dx, cur.x1 + MIN), OUT_MAX.x), y2: Math.min(Math.max(cur.y2 + dy, cur.y1 + MIN), OUT_MAX.y) });
      return;
    }
    const w = cur.x2 - cur.x1;
    const h = cur.y2 - cur.y1;
    const x1 = Math.min(Math.max(cur.x1 + dx, OUT_MIN.x), OUT_MAX.x - w);
    const y1 = Math.min(Math.max(cur.y1 + dy, OUT_MIN.y), OUT_MAX.y - h);
    patch({ x1, y1, x2: x1 + w, y2: y1 + h });
  }
  function onKey(e: KeyboardEvent<HTMLElement>, it: OutItem) {
    const dir: Record<string, [number, number]> = { ArrowLeft: [-STEP, 0], ArrowRight: [STEP, 0], ArrowUp: [0, -STEP], ArrowDown: [0, STEP] };
    const v = dir[e.key];
    if (!v || it.id !== sel) return;
    e.preventDefault();
    nudge(v[0], v[1], e.shiftKey);
  }

  function add() {
    const id = `box-${Date.now().toString(36)}`;
    const cx = OUT_VIEW.x + OUT_VIEW.w / 2;
    const cy = OUT_VIEW.y + OUT_VIEW.h / 2;
    const it: OutItem = {
      id,
      k: "booth",
      x1: cx - 50,
      y1: cy - 28,
      x2: cx + 50,
      y2: cy + 28,
      label: "新しい場所",
      size: 15,
      place: { id: newPlaceId(id), kind: "spot", name: "新しい場所", note: "" },
    };
    setItems((list) => [...list, it]);
    setSel(id);
    setMsg("真ん中に新しい枠を足しました。ドラッグで動かして、名前を直してください");
  }
  function remove() {
    if (!cur) return;
    setItems((list) => list.filter((i) => i.id !== cur.id));
    setSel(null);
    setMsg(`「${plain(cur.label) || cur.place?.name || "枠"}」を消しました（保存するまで、お客さんの地図はそのまま）`);
  }

  async function save() {
    setPending(true);
    setError("");
    const r = await send<{ layout: OutLayout; unlinked: string[] }>("/api/staff/outmap", "PUT", { layout: { items } });
    setPending(false);
    if (!r.ok) return setError(r.error);
    setItems(r.layout.items);
    setBase(JSON.stringify(r.layout.items));
    setMsg(`配置を${savedAt()}${r.unlinked.length ? `（場所が無くなったお店 ${r.unlinked.length} 件は「未定」に戻しました）` : ""}`);
    router.refresh();
  }

  /** 押したときの選び方：押せない・場所の種類（お店・出し物の場所／受付／トイレ…）・建物（中のフロアへ） */
  const tapValue = cur ? (cur.building ? "building" : (cur.place?.kind ?? "none")) : "none";
  function setTap(v: string) {
    if (!cur) return;
    if (v === "none") return patch({ place: undefined, building: undefined });
    if (v === "building") return patch({ place: undefined, building: buildings[0] ?? plain(cur.label) });
    if (cur.place) return patchPlace({ kind: v as PlaceKind });
    patch({ building: undefined, place: { id: newPlaceId(cur.id), kind: v as PlaceKind, name: plain(cur.label) || "新しい場所", note: "" } });
  }
  const shared = cur?.place ? items.filter((i) => i.place?.id === cur.place!.id).length : 0;
  const shopsHere = cur?.place ? (counts[cur.place.id] ?? 0) : 0;

  return (
    <div className="st-stack">
      <div className="le-bar">
        <Button size="sm" icon="足す" onClick={add}>
          枠を足す
        </Button>
        <Button size="sm" variant="primary" pending={pending} disabled={!dirty} onClick={save}>
          配置を保存
        </Button>
        {dirty && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setItems(JSON.parse(base) as OutItem[]);
              setSel(null);
              setMsg("保存した配置に戻しました");
            }}
          >
            保存した配置に戻す
          </Button>
        )}
        <ConfirmDialog
          title="はじめの配置（パンフと同じ）にしますか？"
          confirmLabel="はじめの配置にする"
          triggerLabel="はじめの配置にする"
          triggerVariant="ghost"
          triggerSize="sm"
          tone="primary"
          onConfirm={() => {
            setItems(DEFAULT_LAYOUT.items);
            setSel(null);
            setMsg("はじめの配置にしました（［配置を保存］を押すまで、お客さんの地図はそのまま）");
          }}
        >
          足した枠は無くなります。［配置を保存］を押すまでは保存しません。
        </ConfirmDialog>
        {dirty ? (
          <ConfirmDialog title="保存していない配置があります" confirmLabel="保存しないでやめる" triggerLabel="配置を直すのをやめる" triggerVariant="ghost" triggerSize="sm" onConfirm={onClose}>
            ［配置を保存］を押していない直しは消えます。
          </ConfirmDialog>
        ) : (
          <Button size="sm" variant="ghost" onClick={onClose}>
            配置を直すのをやめる
          </Button>
        )}
      </div>
      <p className="st-place-pick">
        枠をドラッグすると動きます。選んだ枠の右下の角をドラッグすると大きさが変わります。名前・色・押したときの場所は右（スマホでは下）の欄で直します。最後に［配置を保存］（お客さんの地図に出ます。印刷したパンフレットの地図は変わりません）
      </p>

      <div className={cx("pe-cols", cur && "pe-cols--side")}>
        <div className="pe-main">
          <div className="mx-map mx-map--out le-map">
            <div className="mx-map-frame">
              <div className="mx-map-scroll">
                <div
                  className="mx-map-board le-board"
                  ref={boardRef}
                  style={{ aspectRatio: `${OUT_VIEW.w} / ${OUT_VIEW.h}` }}
                  onPointerMove={move}
                  onPointerUp={end}
                  onPointerCancel={end}
                  onClick={() => setSel(null)}
                >
                  <OutsidePlanSvg label="会場マップ（配置を直す）" layout={draft} />
                  <OutsideLabels layout={draft} tabbable={false} />
                  {items.map((it) => (
                    <button
                      key={it.id}
                      type="button"
                      className={cx("le-item", sel === it.id && "le-item--on", !!it.place && "le-item--tap")}
                      style={{
                        left: pctX(it.x1),
                        top: pctY(it.y1),
                        width: `${(((it.x2 - it.x1) / OUT_VIEW.w) * 100).toFixed(3)}%`,
                        height: `${(((it.y2 - it.y1) / OUT_VIEW.h) * 100).toFixed(3)}%`,
                      }}
                      aria-label={`${plain(it.label) || it.place?.name || "枠"}${sel === it.id ? "（選んでいます。矢印のキーで動かせます）" : ""}`}
                      aria-pressed={sel === it.id}
                      onPointerDown={(e) => start(e, it, "move")}
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => onKey(e, it)}
                    >
                      {sel === it.id && <span className="le-handle" aria-hidden="true" onPointerDown={(e) => start(e, it, "size")} />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <p className="st-saved" role="status" aria-live="polite">
            {msg}
          </p>
          {error && (
            <p className="st-err" role="alert">
              {error}
            </p>
          )}
        </div>

        {cur && (
          <Card title="選んでいる枠" className="pe-side">
            <div className="st-form-grid">
              <TextArea label="地図の字（改行もできます）" rows={2} maxLength={40} value={cur.label} onChange={(e) => patch({ label: e.target.value })} />
              <TextField label="下に小さく添える字（なくてよい）" maxLength={20} value={cur.sub ?? ""} onChange={(e) => patch({ sub: e.target.value || undefined })} placeholder="例：体験・休憩" />
              <Select label="字の大きさ" value={nearestSize(cur.size)} onChange={(e) => patch({ size: Number(e.target.value) })} options={SIZES} />
              <Select label="色" value={cur.k} onChange={(e) => patch({ k: e.target.value as OutKind })} options={OUT_KINDS.map((k) => ({ value: k.value, label: k.label }))} />
              <Select
                label="形"
                value={cur.shape ?? "rect"}
                onChange={(e) => patch({ shape: e.target.value === "rect" ? undefined : (e.target.value as OutShape) })}
                options={OUT_SHAPES.map((s) => ({ value: s.value, label: s.label }))}
              />
              <Select
                label="お客さんが押したとき"
                value={tapValue}
                onChange={(e) => setTap(e.target.value)}
                options={[
                  { value: "none", label: "押せない（絵だけ）" },
                  ...PLACE_KINDS.filter((k) => k.value !== "building").map((k) => ({ value: k.value, label: `${k.label}の案内を出す` })),
                  ...(buildings.length ? [{ value: "building", label: "建物の中の地図へ移る" }] : []),
                ]}
                hint="「お店・出し物の場所」にすると、お店の情報の「場所」で選べるようになります"
              />
              {cur.building !== undefined && (
                <Select label="建物" value={cur.building} onChange={(e) => patch({ building: e.target.value })} options={buildings.map((b) => ({ value: b, label: b }))} />
              )}
              {cur.place && (
                <>
                  <TextField label="場所の名前（一覧・お店のページに出る）" maxLength={30} value={cur.place.name} onChange={(e) => patchPlace({ name: e.target.value })} />
                  <TextField label="ひとこと（押したときに出る。なくてよい）" maxLength={60} value={cur.place.note} onChange={(e) => patchPlace({ note: e.target.value })} />
                  <Select
                    label="ほかの枠と同じ場所にする"
                    value={cur.place.id}
                    onChange={(e) => {
                      const v = e.target.value;
                      const other = places.find((p) => p.id === v);
                      if (v === "__own") patch({ place: { ...cur.place!, id: newPlaceId(cur.id) } });
                      else if (other) patch({ place: { ...other } });
                    }}
                    options={[
                      ...places.map((p) => ({ value: p.id, label: `${p.name}（${KIND_LABEL[p.kind] ?? ""}）` })),
                      ...(shared > 1 ? [{ value: "__own", label: "この枠だけの場所にする" }] : []),
                    ]}
                    hint="休憩所・トイレのように、いくつもの枠を 1 つの場所にできます（どれを押しても同じ案内）"
                  />
                  <p className="st-muted">
                    この場所のお店・出し物：{shopsHere} 件{shared > 1 ? `（この場所の枠は ${shared} つ）` : ""}。お店をここにするときは、「お店の場所を決める」かお店の情報の「場所」で選びます
                  </p>
                </>
              )}
              <fieldset className="st-place-pos">
                <legend>少しずつ動かす・大きさを変える（キーボードなら、枠を選んで矢印。Shift＋矢印で大きさ）</legend>
                <div className="le-nudge" role="group" aria-label="動かす">
                  <Button size="sm" onClick={() => nudge(-STEP, 0)}>
                    ← 左
                  </Button>
                  <Button size="sm" onClick={() => nudge(0, -STEP)}>
                    ↑ 上
                  </Button>
                  <Button size="sm" onClick={() => nudge(0, STEP)}>
                    ↓ 下
                  </Button>
                  <Button size="sm" onClick={() => nudge(STEP, 0)}>
                    → 右
                  </Button>
                </div>
                <div className="le-nudge" role="group" aria-label="大きさ">
                  <Button size="sm" onClick={() => nudge(-STEP, 0, true)}>
                    幅 −
                  </Button>
                  <Button size="sm" onClick={() => nudge(STEP, 0, true)}>
                    幅 ＋
                  </Button>
                  <Button size="sm" onClick={() => nudge(0, -STEP, true)}>
                    高さ −
                  </Button>
                  <Button size="sm" onClick={() => nudge(0, STEP, true)}>
                    高さ ＋
                  </Button>
                </div>
              </fieldset>
              <div className="st-row">
                <ConfirmDialog title={`「${plain(cur.label) || cur.place?.name || "この枠"}」を消しますか？`} confirmLabel="消す" triggerLabel="この枠を消す" triggerIcon="消す" triggerSize="sm" onConfirm={remove}>
                  ［配置を保存］を押すまでは、お客さんの地図はそのままです。
                  {cur.place && shared <= 1 && shopsHere > 0 ? `この場所には ${shopsHere} 件のお店・出し物があります。保存すると、そのお店の場所は「未定」に戻ります。` : ""}
                </ConfirmDialog>
                <Button size="sm" variant="ghost" onClick={() => setSel(null)}>
                  選ぶのをやめる
                </Button>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
