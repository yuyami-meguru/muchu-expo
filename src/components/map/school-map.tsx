"use client";

import type { MouseEvent } from "react";
import { cx } from "@/components/ui/cx";
import { PLACE_KINDS, type PlaceKind } from "@/lib/types";
import { CAMPUS_BUILDINGS, CAMPUS_BUS_STOP, CAMPUS_ROADS } from "./campus-shapes";
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
};

const KIND_MARK = Object.fromEntries(PLACE_KINDS.map((k) => [k.value, k.mark])) as Record<PlaceKind, string>;

/**
 * 学校の地図とピン。下の絵は OpenStreetMap の建物と道の形。建物の名前はデータに無いので、ピン（場所の印）で付ける。
 * x・y は左上からの割合（0〜100）。ピンの先が x・y を指す（名前はその下）。選んだピンはいちばん上に重ねる。
 * onPick を渡すと、地図を押した所の x・y を返す（実行委員がピンを置く画面）。
 */
export function SchoolMap({
  pins,
  selected,
  onSelect,
  onPick,
  label = "会場の地図",
  className,
}: {
  pins: MapPin[];
  selected?: string | null;
  onSelect?: (id: string) => void;
  onPick?: (x: number, y: number) => void;
  label?: string;
  className?: string;
}) {
  function pick(e: MouseEvent<HTMLDivElement>) {
    if (!onPick) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.round(((e.clientX - r.left) / r.width) * 1000) / 10;
    const y = Math.round(((e.clientY - r.top) / r.height) * 1000) / 10;
    onPick(Math.min(100, Math.max(0, x)), Math.min(100, Math.max(0, y)));
  }
  return (
    <div className={cx("mx-map", onPick && "mx-map--pick", className)}>
      <div className="mx-map-board" onClick={onPick ? pick : undefined} role={onPick ? "presentation" : undefined}>
        <BaseMap label={label} />
        {/* バス停の名前は、地図の大きさによらず読める字の大きさで（絵の中の字にしない） */}
        <span className="mx-map-bus" style={{ left: `${CAMPUS_BUS_STOP.x}%`, top: `${(CAMPUS_BUS_STOP.y / 70) * 100}%` }} aria-hidden="true">
          {CAMPUS_BUS_STOP.name}
        </span>
        {pins.map((p) => {
          const fac = !!p.kind && p.kind !== "spot";
          const inside = fac ? KIND_MARK[p.kind!] : p.mark !== undefined ? p.mark : p.count ? String(p.count) : "";
          return (
            <button
              key={p.id}
              type="button"
              className={cx(
                "mx-pin",
                p.tone,
                fac && "mx-pin--fac",
                p.multi && "mx-pin--multi",
                !fac && !p.tone && !p.multi && !p.count && "mx-pin--empty",
                selected === p.id && "mx-pin--on",
                p.alert && "mx-pin--alert",
              )}
              style={{ left: `${p.x}%`, top: `${p.y}%` }}
              aria-pressed={selected === p.id}
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
        })}
      </div>
      <p className="mx-map-note">建物の形：© OpenStreetMap contributors（だいたいの形です。くわしい場所は当日の案内をご覧ください）</p>
    </div>
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
