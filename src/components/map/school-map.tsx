"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { cx } from "@/components/ui/cx";
import { FLOOR_PLANS, FLOOR_VIEW } from "@/lib/floor-plans";
import { PLACE_KINDS, type PlaceKind } from "@/lib/types";
import { CAMPUS_BUILDINGS, CAMPUS_BUS_STOP, CAMPUS_ROADS } from "./campus-shapes";
import { FloorLabels, FloorPlanSvg } from "./floor-plan";
import { roomShapeOf, type RoomShape } from "./room-shape";
import "./school-map.css";

export type MapPin = {
  id: string;
  name: string;
  x: number;
  y: number;
  /** 部門の色のクラス（tone-blue など）。いくつもの色の部門がある場所は空 */
  tone?: string;
  /** その場所のお店の数（mark があるときは右上の小さな丸に、無いときはピンの中に出す） */
  count?: number;
  /** 売り切れが出ている（赤い丸に ×。色だけにしない） */
  alert?: boolean;
  /** ピンの種類。spot（お店・出し物の場所）以外のトイレ・受付などは、四角い印に PLACE_KINDS の字を出す */
  kind?: PlaceKind;
  /** ピンの中の字（部門の頭文字。いくつもの部門なら 2 字まで） */
  mark?: string;
  /** いくつもの部門がある場所（白いピン） */
  multi?: boolean;
  /** 読み上げの名前（例「屋外テント（お店 2・売り切れあり）」）。無ければ name */
  label?: string;
  /** 部屋の四角の幅と高さ（割合）。あれば、ピンでなく四角で描く（x・y が真ん中） */
  w?: number;
  h?: number;
};

/** 地図の下の絵：外（学校の建物と道）か、フロア（見取り図。plan が無ければ方眼） */
export type MapBase = { kind: "outside" } | { kind: "floor"; plan?: string; name: string };

const KIND_MARK = Object.fromEntries(PLACE_KINDS.map((k) => [k.value, k.mark])) as Record<PlaceKind, string>;
const reduced = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * 学校の地図とピン。外の絵は OpenStreetMap の建物と道の形（建物の名前はデータに無いので、ピンで付ける）。
 * フロアの絵は見取り図（floor-plans.ts）。部屋はピンでなく四角（w・h のあるピン）で重ね、押すとその部屋を選ぶ。
 * x・y は左上からの割合（0〜100）。ピンの先が x・y を指す（名前はその下。ほかのピン・名前と重なるときは右・左・上へずらし、
 * どこにも入らなければ名前を省く。名前は下の一覧と、押したときの欄で分かる）。重なる順は「部屋 → 選んだ部屋 → ピン → 選んだピン」。
 * フロアの絵は横に長いので、せまい画面では横にスクロールして見る（ページ全体ははみ出さない）。端にぼかしと矢印を出して、横に動かせると分かるように。
 * onPick を渡すと、地図を押した所の x・y を返す（実行委員がピンを置く画面）。
 */
export function SchoolMap({
  pins,
  selected,
  onSelect,
  onPick,
  label = "会場の地図",
  className,
  base = { kind: "outside" },
  caption,
  focusIds,
  tabbable = true,
  pickOnly = false,
  shapeRooms = true,
}: {
  pins: MapPin[];
  selected?: string | null;
  onSelect?: (id: string) => void;
  onPick?: (x: number, y: number) => void;
  label?: string;
  className?: string;
  base?: MapBase;
  /** 地図の左上に出す札（いま見ている面。「知育館 3階」）。横にスクロールしても動かない */
  caption?: string;
  /** 何も選んでいないとき、横にスクロールする見取り図で最初に見せる部屋・ピン（お店のある部屋・玄関など） */
  focusIds?: string[];
  /** false：地図の上の部屋・ピンを Tab で通らない（同じ場所を地図の下の一覧で選べるとき。読み上げも一覧で） */
  tabbable?: boolean;
  /** true のあいだは、部屋・ピンを押しても選ばず、押した所を onPick に返す（実行委員がピンを動かすとき） */
  pickOnly?: boolean;
  /** 部屋の四角を床の形に合わせる（お客さんの地図）。実行委員の画面は、保存してある四角のまま見せるので false */
  shapeRooms?: boolean;
}) {
  function pick(e: MouseEvent<HTMLDivElement>) {
    if (!onPick) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.round(((e.clientX - r.left) / r.width) * 1000) / 10;
    const y = Math.round(((e.clientY - r.top) / r.height) * 1000) / 10;
    onPick(Math.min(100, Math.max(0, x)), Math.min(100, Math.max(0, y)));
  }
  const plan = base.kind === "floor" && base.plan ? FLOOR_PLANS[base.plan] : undefined;
  const floor = base.kind === "floor";
  const planKey = base.kind === "floor" ? `${base.plan ?? ""}:${base.name}` : "outside";
  const scrollRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  // 部屋の四角を床の形に（ホール・廊下が、トイレ・階段・建物の外にかからないように）
  const shapes = useMemo(() => {
    const m = new Map<string, RoomShape>();
    if (!plan || !shapeRooms) return m;
    for (const p of pins) {
      if (!p.w || !p.h) continue;
      const s = roomShapeOf(plan, { x: p.x, y: p.y, w: p.w, h: p.h });
      if (s) m.set(p.id, s);
    }
    return m;
  }, [plan, pins, shapeRooms]);

  // 横にスクロールできるか（左右の端の矢印と、案内の文を出す）
  const [edge, setEdge] = useState({ l: false, r: false });
  useEffect(() => {
    const box = scrollRef.current;
    if (!box) return;
    const update = () => {
      const max = box.scrollWidth - box.clientWidth;
      const l = max > 2 && box.scrollLeft > 4;
      const r = max > 2 && box.scrollLeft < max - 4;
      setEdge((e) => (e.l === l && e.r === r ? e : { l, r }));
    };
    const ro = new ResizeObserver(update);
    ro.observe(box);
    if (boardRef.current) ro.observe(boardRef.current);
    box.addEventListener("scroll", update, { passive: true });
    return () => {
      ro.disconnect();
      box.removeEventListener("scroll", update);
    };
  }, []);

  // 横にスクロールする見取り図では、選んだ部屋・ピンが見える所まで横に動かす（URL で場所を指して開いたときも）。
  // 何も選んでいなければ、お店のある部屋・玄関（focusIds）が見える所へ。フロアを変えて、どちらも無ければ左はしへ
  const focusKey = (focusIds ?? []).join(",");
  const lastPlan = useRef<string | null>(null);
  useEffect(() => {
    const box = scrollRef.current;
    const changed = lastPlan.current !== planKey;
    const first = lastPlan.current === null;
    lastPlan.current = planKey;
    if (!box || box.scrollWidth <= box.clientWidth + 2) return;
    const b = box.getBoundingClientRect();
    const span = (els: Element[]) => {
      const rs = els.map((e) => e.getBoundingClientRect());
      return { l: Math.min(...rs.map((r) => r.left)) - b.left + box.scrollLeft, r: Math.max(...rs.map((r) => r.right)) - b.left + box.scrollLeft };
    };
    const on = box.querySelector('[data-pin][aria-pressed="true"]');
    const ids = focusKey ? focusKey.split(",") : [];
    const marks = on ? [on] : ids.map((id) => box.querySelector(`[data-pin="${CSS.escape(id)}"]`)).filter((e): e is Element => !!e);
    let left: number | null = null;
    if (marks.length) {
      const s = span(marks);
      left = s.r - s.l <= box.clientWidth - 32 ? (s.l + s.r) / 2 - box.clientWidth / 2 : s.l - 16;
    } else if (changed) left = 0;
    if (left === null) return;
    box.scrollTo({ left: Math.max(0, left), behavior: first || changed || reduced() ? "auto" : "smooth" });
  }, [selected, planKey, focusKey]);

  // ピンの名前を、ほかのピン・名前・地図の端と重ならない所へ（せまい画面の外の地図で、名前がピンに隠れないように）
  const sig = pins.map((p) => `${p.id}:${p.x}:${p.y}:${p.name}:${p.count ?? ""}:${p.alert ? 1 : 0}:${p.w ?? ""}`).join("|");
  useLayoutEffect(() => {
    const board = boardRef.current;
    if (!board) return;
    let alive = true;
    // 細くした名前の札（placeLabels の data-ln）は、地図の幅か字の大きさが変わったら元の太さに戻して、置き直す
    let size = "";
    const run = () => {
      if (!alive) return;
      const now = `${board.clientWidth}:${getComputedStyle(board).fontSize}`;
      if (now !== size) {
        size = now;
        board.querySelectorAll<HTMLElement>(".mx-pin[data-ln]").forEach((el) => delete el.dataset.ln);
      }
      placeLabels(board);
    };
    run();
    // 地図の大きさ・名前の大きさ（「文字を大きく」・Web フォントが届いたとき）が変わったら、置き直す。
    // 名前は、どこに置いても・省いても大きさが変わらない作りなので（省くときも visibility）、置き直しで何度も呼ばれることはない。
    // 大きさが変わるのは、入らない名前を細くするときの 1 回だけ（細くした印は、幅か字の大きさが変わるまで残す）
    const ro = new ResizeObserver(run);
    ro.observe(board);
    board.querySelectorAll(".mx-pin-label").forEach((l) => ro.observe(l));
    // 字の形（Web フォント）が届くと名前の幅が変わるので、そのあとにもう一度（あとから読みこむ字の形もあるので、届くたびに）
    const fonts = typeof document !== "undefined" ? document.fonts : undefined;
    fonts?.ready.then(run).catch(() => {});
    fonts?.addEventListener("loadingdone", run);
    return () => {
      alive = false;
      ro.disconnect();
      fonts?.removeEventListener("loadingdone", run);
    };
  }, [sig, selected, planKey]);

  function slide(dir: 1 | -1) {
    const box = scrollRef.current;
    box?.scrollBy({ left: dir * box.clientWidth * 0.6, behavior: reduced() ? "auto" : "smooth" });
  }

  const clamp = !onPick;
  return (
    <div className={cx("mx-map", onPick && "mx-map--pick", pickOnly && "mx-map--pickonly", floor && "mx-map--floor", className)}>
      <div className="mx-map-frame">
        {/* フロアの見取り図は横に動かせる（キーボードでも、ここを選んで ← → で動かせる） */}
        <div className="mx-map-scroll" ref={scrollRef} role={floor ? "group" : undefined} aria-label={floor ? `${base.name}の見取り図（横に動かせます）` : undefined}>
          <div
            className="mx-map-board"
            ref={boardRef}
            style={floor && plan ? { aspectRatio: `${FLOOR_VIEW.w} / ${FLOOR_VIEW.h}` } : undefined}
            onClick={onPick ? pick : undefined}
            role={onPick ? "presentation" : undefined}
          >
            {!floor ? (
              <>
                <BaseMap label={label} />
                {/* バス停の名前は、地図の大きさによらず読める字の大きさで（絵の中の字にしない）。右はしでも切れないように */}
                <span
                  className="mx-map-bus"
                  style={{ left: `min(${CAMPUS_BUS_STOP.x}%, calc(100% - 1.8em - 4px))`, top: `${(CAMPUS_BUS_STOP.y / 70) * 100}%` }}
                  aria-hidden="true"
                >
                  {CAMPUS_BUS_STOP.name}
                </span>
              </>
            ) : plan ? (
              <>
                <FloorPlanSvg shapes={plan} label={`${label}（${base.name}の見取り図）`} />
                <FloorLabels shapes={plan} />
              </>
            ) : (
              <div className="mx-map-grid" role="img" aria-label={`${label}（${base.name}。見取り図はまだありません）`} />
            )}
            {pins.map((p) =>
              p.w && p.h ? (
                <RoomBox key={p.id} p={p} on={selected === p.id} onSelect={onSelect} shape={shapes.get(p.id)} tabbable={tabbable} />
              ) : (
                <PinMark key={p.id} p={p} on={selected === p.id} onSelect={onSelect} tabbable={tabbable} clamp={clamp} />
              ),
            )}
          </div>
        </div>
        {caption && (
          <p className="mx-map-cap" aria-hidden="true">
            {caption}
          </p>
        )}
        {floor && edge.l && (
          <button type="button" className="mx-map-more mx-map-more--l" tabIndex={-1} aria-hidden="true" onClick={() => slide(-1)}>
            <span>←</span>
          </button>
        )}
        {floor && edge.r && (
          <button type="button" className="mx-map-more mx-map-more--r" tabIndex={-1} aria-hidden="true" onClick={() => slide(1)}>
            <span>→</span>
          </button>
        )}
      </div>
      {floor && (edge.l || edge.r) && <p className="mx-map-hint">見取り図は横に動かせます（指で横にずらすか、端の矢印を押してください）。</p>}
      <p className="mx-map-note">
        {!floor
          ? "建物の形：© OpenStreetMap contributors（だいたいの形です。くわしい場所は当日の案内をご覧ください）"
          : plan
            ? "見取り図：建物の案内板をもとにした、だいたいの形です"
            : "このフロアの見取り図はまだありません（四角とピンは、だいたいの位置です）"}
      </p>
    </div>
  );
}

type Box = { l: number; t: number; r: number; b: number };
/** 重なっているか（1px までの重なりは見なかったことにする） */
const hit = (a: Box, b: Box) => a.l + 1 < b.r && b.l + 1 < a.r && a.t + 1 < b.b && b.t + 1 < a.b;

/**
 * ピンの名前の置き場所を決める（data-lp：b＝下・r＝右・l＝左・t＝上・x＝省く）。
 * 選んでいるピン → お店・出し物のピン → 設備の順に、下 → 右 → 左 → 上 で、ほかのピンの頭・置いた名前・地図の字・地図の端と重ならない所。
 * 下と上は、地図の端で切れないよう・ほかと重ならないよう横に少しずらす（--ldx）。どこにも入らない名前は札を細くして（data-ln）もう一度、
 * それでも入らなければ省く（選んでいるピンは省かない）
 */
function placeLabels(board: HTMLElement) {
  const els = [...board.querySelectorAll<HTMLElement>(".mx-pin")];
  if (!els.length) return;
  for (const el of els) {
    el.dataset.lp = "b";
    el.querySelector<HTMLElement>(".mx-pin-label")?.style.removeProperty("--ldx");
  }
  const B = board.getBoundingClientRect();
  if (!B.width || !B.height) return;
  const rel = (e: Element): Box => {
    const r = e.getBoundingClientRect();
    return { l: r.left - B.left, t: r.top - B.top, r: r.right - B.left, b: r.bottom - B.top };
  };
  const items = els.flatMap((el) => {
    const headEl = el.querySelector(".mx-pin-head");
    const lab = el.querySelector<HTMLElement>(".mx-pin-label");
    if (!headEl || !lab) return [];
    const head = rel(headEl);
    const natural = rel(lab);
    const n = el.classList.contains("mx-pin--n");
    const x = el.classList.contains("mx-pin--alert");
    return [
      {
        el,
        lab,
        head,
        // 頭の右上の数・左上の × の丸も入れた、ほかの名前が重なってはいけない所
        block: { l: head.l - (x ? 13 : 2), t: head.t - 8, r: head.r + (n ? 13 : 2), b: head.b },
        natural,
        w: natural.r - natural.l,
        h: natural.b - natural.t,
        n,
        x,
        on: el.classList.contains("mx-pin--on"),
        fac: el.classList.contains("mx-pin--fac"),
      },
    ];
  });
  const fixed = [...board.querySelectorAll(".mx-map-bus, .mx-room-name, .mx-room-mark, .fp-label")].map(rel);
  const placed: Box[] = [];
  const W = B.width;
  const H = B.height;
  const order = [...items].sort((a, b) => Number(b.on) - Number(a.on) || Number(a.fac) - Number(b.fac));
  for (const it of order) {
    const cx = (it.head.l + it.head.r) / 2;
    const dotY = it.head.t + 15;
    const shift = (l: number, r: number) => Math.max(2 - l, Math.min(0, W - 2 - r));
    const cands: { lp: string; box: Box; dx: number }[] = [];
    // 下・上：まず真ん中、だめなら左右に少しずつずらす（名前の端がピンの真下・真上にかかる所まで）。地図の端は越えない
    const below = (f: number) => {
      const dx0 = f * it.w;
      const dx = dx0 + shift(it.natural.l + dx0, it.natural.r + dx0);
      return { lp: "b", box: { ...it.natural, l: it.natural.l + dx, r: it.natural.r + dx }, dx };
    };
    const above = (f: number) => {
      const b = it.head.t - 9;
      const l0 = cx - it.w / 2 + f * it.w;
      const dx = f * it.w + shift(l0, l0 + it.w);
      return { lp: "t", box: { l: cx - it.w / 2 + dx, t: b - it.h, r: cx + it.w / 2 + dx, b }, dx };
    };
    cands.push(below(0));
    {
      const l = cx + 21 + (it.n ? 11 : 0);
      cands.push({ lp: "r", box: { l, t: dotY - it.h / 2, r: l + it.w, b: dotY + it.h / 2 }, dx: 0 });
    }
    {
      const r = cx - 21 - (it.x ? 11 : 0);
      cands.push({ lp: "l", box: { l: r - it.w, t: dotY - it.h / 2, r, b: dotY + it.h / 2 }, dx: 0 });
    }
    cands.push(above(0));
    for (const f of [0.25, -0.25, 0.42, -0.42]) cands.push(below(f), above(f));
    const ok = (bx: Box) =>
      bx.l >= 0 &&
      bx.t >= 0 &&
      bx.r <= W &&
      bx.b <= H &&
      !items.some((o) => o !== it && hit(bx, o.block)) &&
      !placed.some((p) => hit(bx, p)) &&
      !fixed.some((f) => hit(bx, f));
    const best = cands.find((c) => ok(c.box)) ?? (it.on ? cands[0] : null);
    if (!best) {
      // どこにも入らない名前は、札を細く（3 行に）して置き直す（札の大きさが変わるので、ResizeObserver がもう一度ここを呼ぶ）。
      // 細くしても入らなければ省く（名前は下の一覧と、押したときの欄で分かる）
      if (!it.el.dataset.ln) it.el.dataset.ln = "1";
      it.el.dataset.lp = "x";
      continue;
    }
    it.el.dataset.lp = best.lp;
    if (best.dx) it.lab.style.setProperty("--ldx", `${Math.round(best.dx)}px`);
    placed.push(best.box);
  }
}

/** 部屋の四角（押すとその部屋を選ぶ）。中に部屋の名前、お店があれば部門の頭文字と数、売り切れは ×。床の形に切った部屋は SVG で形を描く */
function RoomBox({ p, on, onSelect, shape, tabbable }: { p: MapPin; on: boolean; onSelect?: (id: string) => void; shape?: RoomShape; tabbable: boolean }) {
  const w = p.w ?? 0;
  const h = p.h ?? 0;
  const lab = shape?.label;
  return (
    <button
      type="button"
      data-pin={p.id}
      className={cx(
        "mx-room",
        p.tone,
        !!p.count && "mx-room--has",
        p.multi && "mx-room--multi",
        on && "mx-room--on",
        p.alert && "mx-room--alert",
        shape && "mx-room--shaped",
      )}
      style={{ left: `${p.x - w / 2}%`, top: `${p.y - h / 2}%`, width: `${w}%`, height: `${h}%`, clipPath: shape?.clip }}
      aria-pressed={on}
      aria-label={p.label}
      tabIndex={tabbable ? undefined : -1}
      aria-hidden={tabbable ? undefined : true}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.(p.id);
      }}
    >
      {shape && (
        <svg className="mx-room-shape" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <polygon points={shape.svg} />
        </svg>
      )}
      <span
        className="mx-room-in"
        style={lab ? { top: `${lab.top}%`, height: `${lab.bottom - lab.top}%`, left: `${lab.left}%`, width: `${lab.right - lab.left}%` } : undefined}
      >
        <span className="mx-room-name">{p.name}</span>
        {!!p.count && (
          <span className="mx-room-mark" aria-hidden="true">
            {p.mark}
            <span className="mx-room-n">{p.count}</span>
          </span>
        )}
      </span>
      {p.alert && (
        <span className="mx-room-x" aria-hidden="true">
          ×
        </span>
      )}
    </button>
  );
}

/** ピン（お店・出し物の場所は雫の形、設備は四角い札）。clamp：地図の端でも頭が切れないよう、少し内側に置く */
function PinMark({ p, on, onSelect, tabbable, clamp }: { p: MapPin; on: boolean; onSelect?: (id: string) => void; tabbable: boolean; clamp: boolean }) {
  const fac = !!p.kind && p.kind !== "spot";
  const inside = fac ? KIND_MARK[p.kind!] : p.mark !== undefined ? p.mark : p.count ? String(p.count) : "";
  const showN = !fac && p.mark !== undefined && !!p.count;
  return (
    <button
      type="button"
      data-pin={p.id}
      className={cx(
        "mx-pin",
        p.tone,
        fac && "mx-pin--fac",
        p.multi && "mx-pin--multi",
        !fac && !p.tone && !p.multi && !p.count && "mx-pin--empty",
        on && "mx-pin--on",
        p.alert && "mx-pin--alert",
        showN && "mx-pin--n",
      )}
      style={
        clamp
          ? { left: `clamp(24px, ${p.x}%, calc(100% - 24px))`, top: `clamp(40px, ${p.y}%, calc(100% - 4px))` }
          : { left: `${p.x}%`, top: `${p.y}%` }
      }
      aria-pressed={on}
      aria-label={p.label}
      tabIndex={tabbable ? undefined : -1}
      aria-hidden={tabbable ? undefined : true}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.(p.id);
      }}
    >
      <span className="mx-pin-head" aria-hidden="true">
        <span className="mx-pin-dot">
          <span className={cx("mx-pin-mark", inside.length > 1 && "mx-pin-mark--2")}>{inside}</span>
        </span>
        {showN && <span className="mx-pin-count">{p.count}</span>}
        {p.alert && <span className="mx-pin-x">×</span>}
      </span>
      <span className="mx-pin-label">{p.name}</span>
    </button>
  );
}

/** 校内の絵：OpenStreetMap の建物と道の形（campus-shapes.ts）。座標は 0〜100 × 0〜70 */
function BaseMap({ label }: { label: string }) {
  return (
    <svg className="mx-map-svg" viewBox="0 0 100 70" role="img" aria-label={label}>
      <rect x="0" y="0" width="100" height="70" className="m-ground" />
      {CAMPUS_ROADS.map((r, i) => (
        <path key={`r${i}`} d={r.d} className="m-road" style={{ strokeWidth: r.w }} />
      ))}
      {CAMPUS_BUILDINGS.map((d, i) => (
        <path key={`b${i}`} d={d} className="m-bld" />
      ))}
      <circle cx={CAMPUS_BUS_STOP.x} cy={CAMPUS_BUS_STOP.y} r="1.2" className="m-bus" />
    </svg>
  );
}
