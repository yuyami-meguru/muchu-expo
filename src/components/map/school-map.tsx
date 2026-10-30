"use client";

import { useEffect, useRef, type MouseEvent } from "react";
import { cx } from "@/components/ui/cx";
import { FLOOR_PLANS, FLOOR_VIEW } from "@/lib/floor-plans";
import { PLACE_KINDS, type PlaceKind } from "@/lib/types";
import { CAMPUS_BUILDINGS, CAMPUS_BUS_STOP, CAMPUS_ROADS } from "./campus-shapes";
import { FloorLabels, FloorPlanSvg } from "./floor-plan";
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

/**
 * 学校の地図とピン。外の絵は OpenStreetMap の建物と道の形（建物の名前はデータに無いので、ピンで付ける）。
 * フロアの絵は見取り図（floor-plans.ts）。部屋はピンでなく四角（w・h のあるピン）で重ね、押すとその部屋を選ぶ。
 * x・y は左上からの割合（0〜100）。ピンの先が x・y を指す（名前はその下）。選んだピンはいちばん上に重ねる。
 * onPick を渡すと、地図を押した所の x・y を返す（実行委員がピンを置く画面）。
 * フロアの絵は横に長いので、せまい画面では横にスクロールして見る（ページ全体ははみ出さない）。
 */
export function SchoolMap({
  pins,
  selected,
  onSelect,
  onPick,
  label = "会場の地図",
  className,
  base = { kind: "outside" },
}: {
  pins: MapPin[];
  selected?: string | null;
  onSelect?: (id: string) => void;
  onPick?: (x: number, y: number) => void;
  label?: string;
  className?: string;
  base?: MapBase;
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
  // 横にスクロールする見取り図では、選んだ部屋・ピンが見える所まで横に動かす（URL で場所を指して開いたときも）
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const box = scrollRef.current;
    if (!box || box.scrollWidth <= box.clientWidth) return;
    const el = box.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!el) return;
    const left = el.offsetLeft + el.offsetWidth / 2 - box.clientWidth / 2;
    box.scrollTo({ left: Math.max(0, left), behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, [selected, base.kind, plan]);
  return (
    <div className={cx("mx-map", onPick && "mx-map--pick", floor && "mx-map--floor", className)}>
      <div className="mx-map-scroll" ref={scrollRef}>
        <div
          className="mx-map-board"
          style={floor && plan ? { aspectRatio: `${FLOOR_VIEW.w} / ${FLOOR_VIEW.h}` } : undefined}
          onClick={onPick ? pick : undefined}
          role={onPick ? "presentation" : undefined}
        >
          {!floor ? (
            <>
              <BaseMap label={label} />
              {/* バス停の名前は、地図の大きさによらず読める字の大きさで（絵の中の字にしない） */}
              <span className="mx-map-bus" style={{ left: `${CAMPUS_BUS_STOP.x}%`, top: `${(CAMPUS_BUS_STOP.y / 70) * 100}%` }} aria-hidden="true">
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
              <RoomBox key={p.id} p={p} on={selected === p.id} onSelect={onSelect} />
            ) : (
              <PinMark key={p.id} p={p} on={selected === p.id} onSelect={onSelect} />
            ),
          )}
        </div>
      </div>
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

/** 部屋の四角（押すとその部屋を選ぶ）。中に部屋の名前、お店があれば部門の頭文字と数、売り切れは × */
function RoomBox({ p, on, onSelect }: { p: MapPin; on: boolean; onSelect?: (id: string) => void }) {
  const w = p.w ?? 0;
  const h = p.h ?? 0;
  return (
    <button
      type="button"
      className={cx("mx-room", p.tone, !!p.count && "mx-room--has", p.multi && "mx-room--multi", on && "mx-room--on", p.alert && "mx-room--alert")}
      style={{ left: `${p.x - w / 2}%`, top: `${p.y - h / 2}%`, width: `${w}%`, height: `${h}%` }}
      aria-pressed={on}
      aria-label={p.label}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.(p.id);
      }}
    >
      <span className="mx-room-name">{p.name}</span>
      {!!p.count && (
        <span className="mx-room-mark" aria-hidden="true">
          {p.mark}
          <span className="mx-room-n">{p.count}</span>
        </span>
      )}
      {p.alert && (
        <span className="mx-room-x" aria-hidden="true">
          ×
        </span>
      )}
    </button>
  );
}

/** ピン（お店・出し物の場所は雫の形、設備は四角い札） */
function PinMark({ p, on, onSelect }: { p: MapPin; on: boolean; onSelect?: (id: string) => void }) {
  const fac = !!p.kind && p.kind !== "spot";
  const inside = fac ? KIND_MARK[p.kind!] : p.mark !== undefined ? p.mark : p.count ? String(p.count) : "";
  return (
    <button
      type="button"
      className={cx(
        "mx-pin",
        p.tone,
        fac && "mx-pin--fac",
        p.multi && "mx-pin--multi",
        !fac && !p.tone && !p.multi && !p.count && "mx-pin--empty",
        on && "mx-pin--on",
        p.alert && "mx-pin--alert",
      )}
      style={{ left: `${p.x}%`, top: `${p.y}%` }}
      aria-pressed={on}
      aria-label={p.label}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.(p.id);
      }}
    >
      <span className="mx-pin-head" aria-hidden="true">
        <span className="mx-pin-dot">
          <span className={cx("mx-pin-mark", inside.length > 1 && "mx-pin-mark--2")}>{inside}</span>
        </span>
        {!fac && p.mark !== undefined && !!p.count && <span className="mx-pin-count">{p.count}</span>}
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
