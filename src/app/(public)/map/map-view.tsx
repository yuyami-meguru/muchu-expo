"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { isSelling, LiveShopBadges, shownState } from "@/components/live/live-parts";
import { useLive, usePhase } from "@/components/live/live-provider";
import { SchoolMap, type MapBase, type MapPin } from "@/components/map/school-map";
import { cx } from "@/components/ui/cx";
import { areaName, areaOf, deptLookup, OUTSIDE, PLACE_KINDS, placeKindOf, type Area, type Dept, type Place, type PlaceKind } from "@/lib/types";

/** about はくわしい説明の始めの部分（地図の上で「どんなことをするか」を見せる） */
export type MapShop = { id: string; name: string; dept: string; placeId: string; placeNote: string; catch: string; about: string };

const KIND = Object.fromEntries(PLACE_KINDS.map((k) => [k.value, k])) as Record<PlaceKind, (typeof PLACE_KINDS)[number]>;
/** 部門の頭文字（短い名前の 1 字目。ピンの中に出して、色だけで部門を分けない） */
const initialOf = (d: Dept) => Array.from(d.short || d.name)[0] ?? "？";

/**
 * 校内マップ。上のタブで「外」と、建物の中のフロア（知育館 2階など）を切り替える。
 * ピン・部屋の四角（または「この階の場所」）を押すと、その場所のお店・出し物と、どんなことをするかが出る。
 * 外の地図の建物のピンを押すと、その建物のフロアへ移れる。いちばん下の「フロアガイド」は、全部の面の「どこで何を」の一覧（パンフレットの代わり）。
 * 選んだ面と場所は URL（?area=・?place=）にも入れる（送る・戻るで同じ所が開く）。
 */
export function MapView({
  shops,
  places,
  areas,
  depts,
  initial,
}: {
  shops: MapShop[];
  places: Place[];
  areas: Area[];
  depts: Dept[];
  initial: { area: string; place: string | null };
}) {
  const dept = deptLookup(depts);
  const live = useLive();
  const phase = usePhase();
  const [area, setArea] = useState(initial.area);
  const [sel, setSel] = useState<string | null>(initial.place);
  const [showFac, setShowFac] = useState(true);
  const mapRef = useRef<HTMLElement>(null);
  const hereRef = useRef<HTMLElement>(null);

  const cur = areas.find((a) => a.id === area);
  const base: MapBase = cur ? { kind: "floor", plan: cur.plan, name: areaName(cur) } : { kind: "outside" };
  const tabs = [{ id: OUTSIDE, name: "外" }, ...areas.map((a) => ({ id: a.id, name: areaName(a) }))];
  const shopsAt = (id: string) => shops.filter((s) => s.placeId === id);

  /** 売り切れの印は、品物の札を出すとき（営業中・休憩中）だけ。開催前の試しの売り切れは出さない */
  const soldOut = (list: MapShop[]) =>
    list.some((s) => {
      const st = live.shops[s.id];
      return isSelling(shownState(phase, st?.state)) && Object.values(st?.stock ?? {}).includes("out");
    });

  function pinOf(p: Place): MapPin & { kind: PlaceKind } {
    const kind = placeKindOf(p);
    const box = p.w && p.h ? { w: p.w, h: p.h } : {};
    if (kind !== "spot") return { id: p.id, name: p.name, x: p.x, y: p.y, kind, label: `${p.name}（${KIND[kind].label}）`, ...box };
    const here = shopsAt(p.id);
    const ds = [...new Map(here.map((s) => [dept(s.dept).id, dept(s.dept)])).values()];
    const alert = soldOut(here);
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
      label: `${p.name}（${here.length ? `お店・出し物 ${here.length}` : "お店・出し物なし"}${alert ? "・売り切れあり" : ""}）`,
      ...box,
    };
  }

  const inArea = places.filter((p) => areaOf(p) === area);
  const hasFac = inArea.some((p) => placeKindOf(p) !== "spot");
  const pins = inArea.filter((p) => showFac || placeKindOf(p) === "spot").map(pinOf);

  function go(nextArea: string, place: string | null, scroll: "map" | "here" | null = null) {
    setArea(nextArea);
    setSel(place);
    try {
      const q = place ? `?place=${encodeURIComponent(place)}` : nextArea !== OUTSIDE ? `?area=${encodeURIComponent(nextArea)}` : "";
      window.history.replaceState(null, "", `/map${q}`);
    } catch {
      // URL を変えられなくても、選ぶことはできる
    }
    const el = scroll === "map" ? mapRef.current : scroll === "here" ? hereRef.current : null;
    el?.scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }

  const place = places.find((p) => p.id === sel && areaOf(p) === area);
  const placeKind = place ? placeKindOf(place) : "spot";
  const here = place ? shopsAt(place.id) : [];
  /** 建物のピンなら、その建物のフロア（フロアの「建物の名前」がピンの名前と同じもの） */
  const floorsOf = (p: Place) => areas.filter((a) => a.building === p.name);
  const nowhere = shops.filter((s) => !s.placeId || !places.some((p) => p.id === s.placeId));
  const usedDepts = depts.filter((d) => shops.some((s) => s.dept === d.id && places.some((p) => p.id === s.placeId)));

  return (
    <div className="mp-grid">
      {/* 外・フロアの切り替え（横に並べ、多いときは横にスクロール） */}
      <nav className="mp-areas" aria-label="外・フロアの切り替え" ref={mapRef}>
        {tabs.map((t) => (
          <button key={t.id} type="button" className="mp-area" aria-pressed={area === t.id} onClick={() => go(t.id, null)}>
            {t.name}
          </button>
        ))}
      </nav>

      <div className="mp-map">
        <SchoolMap pins={pins} selected={sel} onSelect={(id) => go(area, id)} base={base} label={cur ? `${areaName(cur)}の地図` : "会場の地図（外）"} />
        {cur && <p className="mp-hint">部屋の四角を押すと、その部屋のお店・出し物が出ます。見取り図は横にスクロールできます。</p>}
      </div>

      {/* 選んだ場所 */}
      <section className="mp-here" aria-live="polite" ref={hereRef}>
        {place ? (
          <>
            <p className="mp-where">{cur ? areaName(cur) : "外"}</p>
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
            {placeKind === "building" &&
              (floorsOf(place).length ? (
                <div className="mp-floors">
                  <p className="mp-note">中のフロアを見る：</p>
                  {floorsOf(place).map((a) => (
                    <button key={a.id} type="button" className="mp-floor-btn" onClick={() => go(a.id, null, "map")}>
                      {a.floor} ▶
                    </button>
                  ))}
                </div>
              ) : (
                <p className="mp-note">この建物のフロアの案内は、まだありません。</p>
              ))}
            {placeKind === "spot" &&
              (here.length ? (
                <ShopList shops={here} dept={dept} />
              ) : (
                <p className="mp-note">この場所のお店・出し物は、まだ決まっていません。</p>
              ))}
          </>
        ) : (
          <p className="mp-note">{cur ? "見取り図の部屋の四角か、下の「この階の場所」を押してください。" : "地図のピンか、下の「外の場所」を押してください。"}</p>
        )}
      </section>

      {/* この面の場所（ピンが小さい・重なっているときも、ここから選べる） */}
      <section className="mp-places" aria-labelledby="mp-places-h">
        <div className="mp-places-head">
          <h2 id="mp-places-h">{cur ? `この階（${areaName(cur)}）の場所` : "外の場所"}</h2>
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
              <button type="button" className={cx("mp-place", p.tone)} aria-pressed={sel === p.id} onClick={() => go(area, p.id, "here")}>
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
          <div>
            <dt>
              <span className="mp-glyph mp-glyph--multi" aria-hidden="true">
                <span>体茶</span>
              </span>
            </dt>
            <dd>いくつかの部門がある場所（白い印）</dd>
          </div>
          <div>
            <dt>
              <span className="mp-glyph mp-glyph--fac" aria-hidden="true">
                <span>WC</span>
              </span>
            </dt>
            <dd>トイレ・受付・救護・建物などの設備（四角い印）</dd>
          </div>
          <div>
            <dt>
              <span className="mp-count" aria-hidden="true">
                2
              </span>
            </dt>
            <dd>数字はその場所のお店・出し物の数</dd>
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

      {/* フロアガイド：全部の面の「どこで何を」（パンフレットの代わりに読める一覧） */}
      <section className="mp-guide" aria-labelledby="mp-guide-h">
        <h2 id="mp-guide-h">フロアガイド（どこで何をしているか）</h2>
        <p className="mp-note">場所の名前を押すと、地図でその場所を見られます。お店・出し物の名前を押すと、くわしいページへ。</p>
        {tabs.map((t) => {
          const list = places.filter((p) => areaOf(p) === t.id && placeKindOf(p) === "spot" && shopsAt(p.id).length);
          const fac = places.filter((p) => areaOf(p) === t.id && placeKindOf(p) !== "spot" && placeKindOf(p) !== "building");
          if (!list.length && !fac.length) return null;
          return (
            <div key={t.id} className="mp-guide-area">
              <h3>{t.name}</h3>
              {list.map((p) => (
                <div key={p.id} className="mp-guide-place">
                  <button type="button" className="mp-guide-where" onClick={() => go(t.id, p.id, "map")}>
                    <Icon name="場所" size={16} />
                    {p.name}
                  </button>
                  <ShopList shops={shopsAt(p.id)} dept={dept} compact />
                </div>
              ))}
              {fac.length > 0 && (
                <p className="mp-guide-fac">
                  {fac.map((p, i) => (
                    <span key={p.id}>
                      {i > 0 && "・"}
                      <button type="button" className="mp-guide-facbtn" onClick={() => go(t.id, p.id, "map")}>
                        {p.name}
                      </button>
                    </span>
                  ))}
                </p>
              )}
            </div>
          );
        })}
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

/** その場所のお店・出し物：名前・部門・いまの様子・ひとこと・どんなことをするか（説明の始め） */
function ShopList({ shops, dept, compact }: { shops: MapShop[]; dept: ReturnType<typeof deptLookup>; compact?: boolean }) {
  return (
    <ul className={cx("mp-list", compact && "mp-list--compact")}>
      {shops.map((s) => (
        <li key={s.id} className={`tone-${dept(s.dept).color}`}>
          <Link href={`/shops/${s.id}`}>
            <span className="mp-dept">{dept(s.dept).short}</span>
            <span className="mp-name">{s.name}</span>
            <LiveShopBadges shopId={s.id} />
            {s.catch && <span className="mp-catch">{s.catch}</span>}
            {!compact && s.about && <span className="mp-about">{s.about}</span>}
            {s.placeNote && <span className="mp-pnote">{s.placeNote}</span>}
            <span className="mp-more" aria-hidden="true">
              くわしく ▶
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
