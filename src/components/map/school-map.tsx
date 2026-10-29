"use client";

import type { MouseEvent } from "react";
import { cx } from "@/components/ui/cx";
import "./school-map.css";

export type MapPin = {
  id: string;
  name: string;
  x: number;
  y: number;
  /** 部門の色のクラス（tone-blue など）。いくつもの色の部門がある場所は空 */
  tone?: string;
  /** ピンの上の小さな数（お店の数） */
  count?: number;
  /** 売り切れが出ている */
  alert?: boolean;
};

/**
 * 学校の地図とピン。地図の絵は「仮の配置図」（校舎の配置図をもらったら public/map.svg に差しかえて、base を変える）。
 * x・y は左上からの割合（0〜100）。onPick を渡すと、地図を押した所の x・y を返す（実行委員がピンを置く画面）。
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
        {pins.map((p) => (
          <button
            key={p.id}
            type="button"
            className={cx("mx-pin", p.tone, selected === p.id && "mx-pin--on", p.alert && "mx-pin--alert")}
            style={{ left: `${p.x}%`, top: `${p.y}%` }}
            aria-pressed={selected === p.id}
            onClick={(e) => {
              e.stopPropagation();
              onSelect?.(p.id);
            }}
          >
            <span className="mx-pin-dot" aria-hidden="true">
              {p.count ? <span>{p.count}</span> : null}
            </span>
            <span className="mx-pin-label">{p.name}</span>
          </button>
        ))}
      </div>
      <p className="mx-map-note">※ 仮の配置図です。くわしい場所は当日の案内をご覧ください。</p>
    </div>
  );
}

/** 仮の配置図（校舎・知育館・中庭・グラウンド・正門）。座標は 0〜100 × 0〜70 */
function BaseMap({ label }: { label: string }) {
  return (
    <svg className="mx-map-svg" viewBox="0 0 100 70" role="img" aria-label={label}>
      <rect x="0" y="0" width="100" height="70" className="m-ground" />
      <path d="M0 58 L100 50 L100 56 L0 64 Z" className="m-road" />
      <rect x="6" y="10" width="34" height="34" rx="1.5" className="m-bld" />
      <text x="23" y="29" className="m-txt">校舎</text>
      <rect x="62" y="8" width="24" height="15" rx="1.5" className="m-bld" />
      <text x="74" y="17.5" className="m-txt">知育館</text>
      <rect x="44" y="30" width="24" height="16" rx="3" className="m-yard" />
      <text x="56" y="39.5" className="m-txt m-txt--s">中庭</text>
      <rect x="74" y="28" width="22" height="20" rx="2" className="m-field" />
      <text x="85" y="39" className="m-txt m-txt--s">グラウンド</text>
      <rect x="44" y="55" width="10" height="4" className="m-gate" />
      <text x="49" y="66" className="m-txt m-txt--s">正門</text>
    </svg>
  );
}
