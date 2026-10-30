"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { isSelling, LiveShopBadges, shownState } from "@/components/live/live-parts";
import { useLive, usePhase } from "@/components/live/live-provider";
import { SchoolMap, type MapPin } from "@/components/map/school-map";
import { cx } from "@/components/ui/cx";
import { deptLookup, PLACE_KINDS, placeKindOf, type Dept, type Place, type PlaceKind } from "@/lib/types";

type MapShop = { id: string; name: string; dept: string; placeId: string; placeNote: string; catch: string };

const KIND = Object.fromEntries(PLACE_KINDS.map((k) => [k.value, k])) as Record<PlaceKind, (typeof PLACE_KINDS)[number]>;
/** 部門の頭文字（短い名前の 1 字目。ピンの中に出して、色だけで部門を分けない） */
const initialOf = (d: Dept) => Array.from(d.short || d.name)[0] ?? "？";

/**
 * 校内マップ。ピン（または地図の下の「場所の一覧」）を押すと、その場所のお店・出し物が出る。
 * トイレ・受付などの設備のピンは「設備を表示」で出し入れできる。選んだ場所は URL（?place=）にも入れる（送る・戻るで同じ場所が開く）
 */
export function MapView({ shops, places, depts, initial }: { shops: MapShop[]; places: Place[]; depts: Dept[]; initial: string | null }) {
  const dept = deptLookup(depts);
  const live = useLive();
  const phase = usePhase();
  const [sel, setSel] = useState<string | null>(initial ?? places.find((p) => placeKindOf(p) === "spot")?.id ?? places[0]?.id ?? null);
  const [showFac, setShowFac] = useState(true);
  const hereRef = useRef<HTMLElement>(null);
  const hasFac = places.some((p) => placeKindOf(p) !== "spot");

  const pins: (MapPin & { kind: PlaceKind })[] = places
    .filter((p) => showFac || placeKindOf(p) === "spot")
    .map((p) => {
      const kind = placeKindOf(p);
      if (kind !== "spot") return { id: p.id, name: p.name, x: p.x, y: p.y, kind, label: `${p.name}（${KIND[kind].label}）` };
      const here = shops.filter((s) => s.placeId === p.id);
      const ds = [...new Map(here.map((s) => [dept(s.dept).id, dept(s.dept)])).values()];
      // 売り切れの印は、品物の札を出すとき（営業中・休憩中）だけ。開催前の試しの売り切れは出さない
      const alert = here.some((s) => {
        const st = live.shops[s.id];
        return isSelling(shownState(phase, st?.state)) && Object.values(st?.stock ?? {}).includes("out");
      });
      return {
        id: p.id,
        name: p.name,
        x: p.x,
        y: p.y,
        kind,
        count: here.length,
        mark: ds.slice(0, 2).map(initialOf).join(""),
        multi: ds.length > 1,
        tone: ds.length === 1 ? `tone-${ds[0].color}` : undefined,
        alert,
        label: `${p.name}（お店 ${here.length}${alert ? "・売り切れあり" : ""}）`,
      };
    });

  function choose(id: string, fromList = false) {
    setSel(id);
    try {
      window.history.replaceState(null, "", `/map?place=${encodeURIComponent(id)}`);
    } catch {
      // URL を変えられなくても、選ぶことはできる
    }
    // 下の一覧から選んだときは、その場所の説明が見えるところまで動かす
    if (fromList) hereRef.current?.scrollIntoView({ block: "nearest", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }

  const place = places.find((p) => p.id === sel);
  const placeKind = place ? placeKindOf(place) : "spot";
  const here = shops.filter((s) => s.placeId === sel);
  const nowhere = shops.filter((s) => !s.placeId || !places.some((p) => p.id === s.placeId));
  const usedDepts = depts.filter((d) => shops.some((s) => s.dept === d.id && places.some((p) => p.id === s.placeId)));

  return (
    <div className="mp-grid">
      <div className="mp-map">
        <SchoolMap pins={pins} selected={sel} onSelect={(id) => choose(id)} />
      </div>

      {/* 選んだ場所 */}
      <section className="mp-here" aria-live="polite" ref={hereRef}>
        {place ? (
          <>
            <h2>
              {placeKind === "spot" ? (
                <Icon name="場所" size={20} />
              ) : (
                <span className="mp-fac" aria-hidden="true">
                  {KIND[placeKind].mark}
                </span>
              )}
              {place.name}
            </h2>
            {placeKind !== "spot" && <p className="mp-kind">{KIND[placeKind].label}</p>}
            {place.note && <p className="mp-note">{place.note}</p>}
            {placeKind === "spot" &&
              (here.length ? (
                <ul className="mp-list">
                  {here.map((s) => (
                    <li key={s.id} className={`tone-${dept(s.dept).color}`}>
                      <Link href={`/shops/${s.id}`}>
                        <span className="mp-dept">{dept(s.dept).short}</span>
                        <span className="mp-name">{s.name}</span>
                        {s.placeNote && <span className="mp-pnote">{s.placeNote}</span>}
                        <LiveShopBadges shopId={s.id} />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mp-note">この場所のお店は、まだ決まっていません。</p>
              ))}
          </>
        ) : (
          <p className="mp-note">地図のピンか、下の「場所の一覧」を押してください。</p>
        )}
      </section>

      {/* 場所の一覧（ピンが小さい・重なっているときも、ここから選べる） */}
      <section className="mp-places" aria-labelledby="mp-places-h">
        <div className="mp-places-head">
          <h2 id="mp-places-h">場所の一覧</h2>
          {hasFac && (
            <button type="button" className="mp-fac-toggle" aria-pressed={showFac} onClick={() => setShowFac((v) => !v)}>
              <span className="mp-fac-box" aria-hidden="true">
                {showFac ? "✓" : ""}
              </span>
              トイレ・受付などを表示
            </button>
          )}
        </div>
        <ul>
          {pins.map((p) => (
            <li key={p.id}>
              <button type="button" className={cx("mp-place", p.tone)} aria-pressed={sel === p.id} onClick={() => choose(p.id, true)}>
                <span className={cx("mp-glyph", p.kind !== "spot" && "mp-glyph--fac", p.multi && "mp-glyph--multi")} aria-hidden="true">
                  <span>{p.kind !== "spot" ? KIND[p.kind].mark : p.mark}</span>
                </span>
                <span className="mp-place-name">{p.name}</span>
                {p.kind === "spot" && <span className="mp-place-n">お店 {p.count ?? 0}</span>}
                {p.alert && <span className="mp-place-x">× 売り切れあり</span>}
              </button>
            </li>
          ))}
        </ul>
      </section>

      {/* 地図の印（押せる物ではないので、枠や塗りのない表にする） */}
      <section className="mp-legend" aria-labelledby="mp-legend-h">
        <h2 id="mp-legend-h">地図の印</h2>
        <dl>
          {usedDepts.map((d) => (
            <div key={d.id} className={`tone-${d.color}`}>
              <dt>
                <span className="mp-glyph" aria-hidden="true">
                  <span>{initialOf(d)}</span>
                </span>
              </dt>
              <dd>{d.name}</dd>
            </div>
          ))}
          {pins.some((p) => p.multi) && (
            <div>
              <dt>
                <span className="mp-glyph mp-glyph--multi" aria-hidden="true">
                  <span>{pins.find((p) => p.multi)?.mark}</span>
                </span>
              </dt>
              <dd>いくつかの部門がある場所（白い印）</dd>
            </div>
          )}
          {hasFac && (
            <div>
              <dt>
                <span className="mp-glyph mp-glyph--fac" aria-hidden="true">
                  <span>WC</span>
                </span>
              </dt>
              <dd>トイレ・受付・救護などの設備（四角い印）</dd>
            </div>
          )}
          <div>
            <dt>
              <span className="mp-count" aria-hidden="true">
                2
              </span>
            </dt>
            <dd>数字はその場所のお店の数</dd>
          </div>
          <div>
            <dt>
              <span className="mp-x" aria-hidden="true">
                ×
              </span>
            </dt>
            <dd>売り切れが出ている場所</dd>
          </div>
        </dl>
      </section>

      {nowhere.length > 0 && (
        <section className="mp-nowhere" aria-labelledby="mp-nowhere-h">
          <h2 id="mp-nowhere-h">場所が決まっていないお店・出し物</h2>
          <p className="mp-note">場所は決まりしだいお知らせします。</p>
          <ul>
            {nowhere.map((s) => (
              <li key={s.id}>
                <Link href={`/shops/${s.id}`}>{s.name}</Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
