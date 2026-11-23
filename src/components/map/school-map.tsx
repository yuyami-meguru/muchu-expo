"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent, type PointerEvent, type RefObject } from "react";
import { cx } from "@/components/ui/cx";
import { FLOOR_PLANS, FLOOR_VIEW } from "@/lib/floor-plans";
import { OUT_VIEW, type OutLayout } from "@/lib/outside-plan";
import { PLACE_KINDS, type PlaceKind } from "@/lib/types";
import { FloorLabels, FloorPlanSvg } from "./floor-plan";
import { OutsideLabels, OutsidePlanSvg } from "./outside-plan";
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
  /**
   * その場所のお店・出し物（名前・部門の頭文字・部門の色のクラス）。あれば、部屋の四角の中と、ピンの名前の札に名前を出す
   * （何があるかが地図を見ただけで分かるように。無ければ、部屋は頭文字と数、ピンは場所の名前）
   */
  items?: { name: string; mark: string; tone?: string }[];
  /**
   * 会場マップに描いてある枠そのもの（外の地図の「大食堂」「受付」など。v0.17.0）。描いてある枠と名前の上に、透明な四角を重ねて押せるようにする
   * （名前は地図の字のまま。お店・出し物があれば右上に頭文字と数、選ぶと太い枠）
   */
  plan?: boolean;
  /** 1 つの場所に枠がいくつもあるとき（トイレ 3 か所など）の何番目か。0 だけを Tab・読み上げの対象にする */
  part?: number;
};

/** 地図の下の絵：外（会場マップ。パンフと同じ配置図）か、フロア（見取り図。plan が無ければ方眼） */
export type MapBase = { kind: "outside" } | { kind: "floor"; plan?: string; name: string };

const KIND_MARK = Object.fromEntries(PLACE_KINDS.map((k) => [k.value, k.mark])) as Record<PlaceKind, string>;
const reduced = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * 学校の地図とピン。外の絵は会場マップ（パンフレット 2 ページ目と同じ配置図。outside-plan）、フロアの絵は見取り図（floor-plans.ts）。
 * 部屋はピンでなく四角（w・h のあるピン）で重ね、押すとその部屋を選ぶ。
 * x・y は左上からの割合（0〜100）。ピンの先が x・y を指す（名前はその下。ほかのピン・名前・地図の字と重なるときは右・左・上へずらし、
 * どこにも入らなければ名前を省く。名前は下の一覧と、押したときの欄で分かる）。重なる順は「部屋 → 選んだ部屋 → ピン → 選んだピン」。
 * 地図の字を読める大きさに保つため、せまい画面では横にスクロールして見る（ページ全体ははみ出さない）。端にぼかしと矢印を出して、横に動かせると分かるように。
 * onPick を渡すと、地図を押した所の x・y を返す（実行委員がピンを置く画面）。onBuilding を渡すと、外の地図の建物（知育館）を押せる（中の地図へ）。
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
  onBuilding,
  outLayout,
  drag,
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
  /** 外の地図の建物（知育館）を押したとき（その建物の中の地図へ）。無ければ建物は押せない字のまま */
  onBuilding?: (building: string) => void;
  /** 外の会場マップの配置（無ければはじめの配置） */
  outLayout?: OutLayout;
  /**
   * 実行委員がピン・部屋の四角をドラッグで動かす（v0.22.0。ユーザー「配置をマップ上で自由に」）。id の物の上に動かすつまみを重ね、
   * 部屋の四角は右下の角で大きさも変えられる。動かすたびに onChange（x・y は割合、部屋は w・h も）
   */
  drag?: { id: string; onChange: (p: DragPatch) => void };
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
  const sig = pins
    .map((p) => `${p.id}:${p.x}:${p.y}:${p.name}:${p.count ?? ""}:${p.alert ? 1 : 0}:${p.w ?? ""}:${(p.items ?? []).map((i) => i.name).join("/")}`)
    .join("|");
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
      fitRooms(board);
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
  const scrolls = edge.l || edge.r;
  return (
    <div className={cx("mx-map", onPick && "mx-map--pick", pickOnly && "mx-map--pickonly", floor ? "mx-map--floor" : "mx-map--out", className)}>
      <div className="mx-map-frame">
        {/* 見取り図と、せまい画面の外の地図は横に動かせる（キーボードでも、ここを選んで ← → で動かせる） */}
        <div
          className="mx-map-scroll"
          ref={scrollRef}
          role={floor || scrolls ? "group" : undefined}
          aria-label={floor ? `${base.name}の見取り図（横に動かせます）` : scrolls ? "外の地図（横に動かせます）" : undefined}
        >
          <div
            className="mx-map-board"
            ref={boardRef}
            style={
              floor && plan ? { aspectRatio: `${FLOOR_VIEW.w} / ${FLOOR_VIEW.h}` } : !floor ? { aspectRatio: `${OUT_VIEW.w} / ${OUT_VIEW.h}` } : undefined
            }
            onClick={onPick ? pick : undefined}
            role={onPick ? "presentation" : undefined}
          >
            {!floor ? (
              <>
                <OutsidePlanSvg label={label} layout={outLayout} />
                <OutsideLabels layout={outLayout} onBuilding={onPick ? undefined : onBuilding} tabbable={tabbable} />
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
                <RoomBox key={`${p.id}:${p.part ?? 0}`} p={p} on={selected === p.id} onSelect={onSelect} shape={shapes.get(p.id)} tabbable={tabbable && !p.part} />
              ) : (
                <PinMark key={p.id} p={p} on={selected === p.id} onSelect={onSelect} tabbable={tabbable} clamp={clamp} />
              ),
            )}
            {drag && <DragGrip pin={pins.find((p) => p.id === drag.id && !p.part)} boardRef={boardRef} onChange={drag.onChange} />}
          </div>
        </div>
        {caption && (
          <p className="mx-map-cap" aria-hidden="true">
            {caption}
          </p>
        )}
        {edge.l && (
          <button type="button" className="mx-map-more mx-map-more--l" tabIndex={-1} aria-hidden="true" onClick={() => slide(-1)}>
            <span>←</span>
          </button>
        )}
        {edge.r && (
          <button type="button" className="mx-map-more mx-map-more--r" tabIndex={-1} aria-hidden="true" onClick={() => slide(1)}>
            <span>→</span>
          </button>
        )}
      </div>
      {scrolls && <p className="mx-map-hint">{floor ? "見取り図" : "地図"}は横に動かせます（指で横にずらすか、端の矢印を押してください）。</p>}
      <p className="mx-map-note">
        {!floor
          ? "会場マップ：パンフレットと同じ配置図です（だいたいの位置です。くわしい場所は当日の案内をご覧ください）"
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
  const fixed = [...board.querySelectorAll(".op-label, .op-hit, .mx-room-name, .mx-room-mark, .mx-room-item, .mx-room-more, .fp-label")].map(rel);
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

/**
 * 部屋の中のお店・出し物の名前：入りきらなければ下から省いて「ほか N 件」に（1 件目は省かない。1 件目の名前は 2 行まで）。
 * 地図の幅・字の大きさ・字の形が変わるたびに、置き直しといっしょに測り直す
 */
function fitRooms(board: HTMLElement) {
  for (const box of board.querySelectorAll<HTMLElement>(".mx-room-items")) {
    const items = [...box.querySelectorAll<HTMLElement>(".mx-room-item")];
    const more = box.querySelector<HTMLElement>(".mx-room-more");
    for (const el of items) el.hidden = false;
    if (more) more.hidden = true;
    let shown = items.length;
    while (shown > 1 && box.scrollHeight > box.clientHeight + 1) {
      shown -= 1;
      items[shown].hidden = true;
      if (more) {
        more.hidden = false;
        more.textContent = `ほか ${items.length - shown} 件`;
      }
    }
  }
}

/** 部屋の四角（押すとその部屋を選ぶ）。中に部屋の名前と、お店・出し物の名前（部門の頭文字つき。無ければ頭文字と数）、売り切れは ×。床の形に切った部屋は SVG で形を描く */
function RoomBox({ p, on, onSelect, shape, tabbable }: { p: MapPin; on: boolean; onSelect?: (id: string) => void; shape?: RoomShape; tabbable: boolean }) {
  const w = p.w ?? 0;
  const h = p.h ?? 0;
  const lab = shape?.label;
  // 会場マップの枠：名前は地図に描いてあるので出さない。お店・出し物があれば右上に頭文字と数（売り切れは ×）
  if (p.plan) {
    return (
      <button
        type="button"
        data-pin={p.id}
        className={cx("mx-room", "mx-room--plan", p.tone, !!p.count && "mx-room--has", p.multi && "mx-room--multi", on && "mx-room--on", p.alert && "mx-room--alert")}
        style={{ left: `${p.x - w / 2}%`, top: `${p.y - h / 2}%`, width: `${w}%`, height: `${h}%` }}
        aria-pressed={on}
        aria-label={p.label}
        tabIndex={tabbable ? undefined : -1}
        aria-hidden={tabbable ? undefined : true}
        onClick={(e) => {
          e.stopPropagation();
          onSelect?.(p.id);
        }}
      >
        {!!p.count && !p.part && (
          <span className="mx-room-badge" aria-hidden="true">
            {p.mark}
            <span className="mx-room-n">{p.count}</span>
          </span>
        )}
        {p.alert && !p.part && (
          <span className="mx-room-x" aria-hidden="true">
            ×
          </span>
        )}
      </button>
    );
  }
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
        {p.items?.length ? (
          <span className="mx-room-items" aria-hidden="true">
            {p.items.map((it, i) => (
              <span key={i} className={cx("mx-room-item", it.tone)}>
                <span className="mx-room-item-mark">{it.mark}</span>
                <span className="mx-room-item-name">{it.name}</span>
              </span>
            ))}
            <span className="mx-room-more" hidden />
          </span>
        ) : (
          !!p.count && (
            <span className="mx-room-mark" aria-hidden="true">
              {p.mark}
              <span className="mx-room-n">{p.count}</span>
            </span>
          )
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
      {/* 名前の札：お店・出し物があれば、その名前（2 件まで。ほかは「ほか N 件」）。無ければ場所の名前 */}
      <span className="mx-pin-label">
        {!fac && p.items?.length ? (
          <>
            {p.items.slice(0, 2).map((it, i) => (
              <span key={i} className="mx-pin-item">
                {it.name}
              </span>
            ))}
            {p.items.length > 2 && <span className="mx-pin-item mx-pin-more">ほか {p.items.length - 2} 件</span>}
          </>
        ) : (
          p.name
        )}
      </span>
    </button>
  );
}

/** ドラッグで変える値（x・y は地図の割合。部屋の四角は w・h も） */
export type DragPatch = { x: number; y: number; w?: number; h?: number };
/** 部屋の四角の小さすぎない大きさ（割合） */
const GRIP_MIN = 3;
const r1 = (v: number) => Math.round(v * 10) / 10;

/**
 * 選んだピン・部屋の四角を指やマウスで動かすつまみ（実行委員の「地図のピン」。v0.22.0）。
 * ピンは頭の所をつかんで動かす。部屋の四角は中をつかんで動かし、右下の角で大きさを変える（左上はそのまま）。
 * 画面の読み上げ・キーボードでは、横の欄の［← 左］などのボタンで動かす（このつまみは読み上げない）
 */
function DragGrip({ pin, boardRef, onChange }: { pin: MapPin | undefined; boardRef: RefObject<HTMLDivElement | null>; onChange: (p: DragPatch) => void }) {
  const st = useRef<{ mode: "move" | "size"; px: number; py: number; x: number; y: number; w: number; h: number; bw: number; bh: number; moved: boolean } | null>(null);
  if (!pin) return null;
  const box = !!pin.w && !!pin.h;
  const w = pin.w ?? 0;
  const h = pin.h ?? 0;
  function begin(e: PointerEvent<HTMLElement>, mode: "move" | "size") {
    if (e.button !== 0 || !pin) return;
    e.stopPropagation();
    e.preventDefault();
    const r = boardRef.current?.getBoundingClientRect();
    if (!r?.width || !r.height) return;
    st.current = { mode, px: e.clientX, py: e.clientY, x: pin.x, y: pin.y, w, h, bw: r.width, bh: r.height, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function moveTo(e: PointerEvent<HTMLElement>) {
    const s = st.current;
    if (!s) return;
    if (!s.moved && Math.hypot(e.clientX - s.px, e.clientY - s.py) < 3) return;
    s.moved = true;
    const dx = ((e.clientX - s.px) / s.bw) * 100;
    const dy = ((e.clientY - s.py) / s.bh) * 100;
    if (s.mode === "size") {
      const left = s.x - s.w / 2;
      const top = s.y - s.h / 2;
      const nw = Math.min(100 - left, Math.max(GRIP_MIN, s.w + dx));
      const nh = Math.min(100 - top, Math.max(GRIP_MIN, s.h + dy));
      onChange({ x: r1(left + nw / 2), y: r1(top + nh / 2), w: r1(nw), h: r1(nh) });
      return;
    }
    const hw = box ? s.w / 2 : 0;
    const hh = box ? s.h / 2 : 0;
    const x = Math.min(100 - hw, Math.max(hw, s.x + dx));
    const y = Math.min(100 - hh, Math.max(hh, s.y + dy));
    onChange(box ? { x: r1(x), y: r1(y), w: s.w, h: s.h } : { x: r1(x), y: r1(y) });
  }
  const end = () => {
    st.current = null;
  };
  const common = {
    "aria-hidden": true,
    onPointerDown: (e: PointerEvent<HTMLElement>) => begin(e, "move"),
    onPointerMove: moveTo,
    onPointerUp: end,
    onPointerCancel: end,
    // 放したときの「押した」が地図に届くと、そこが「ここ？」になってしまうので止める
    onClick: (e: MouseEvent<HTMLElement>) => e.stopPropagation(),
  } as const;
  return box ? (
    <div className="mx-grip mx-grip--box" style={{ left: `${pin.x - w / 2}%`, top: `${pin.y - h / 2}%`, width: `${w}%`, height: `${h}%` }} title="ドラッグで動かす" {...common}>
      <span className="mx-grip-size" title="ドラッグで大きさを変える" onPointerDown={(e) => begin(e, "size")} />
    </div>
  ) : (
    <div className="mx-grip mx-grip--pin" style={{ left: `${pin.x}%`, top: `${pin.y}%` }} title="ドラッグで動かす" {...common} />
  );
}
