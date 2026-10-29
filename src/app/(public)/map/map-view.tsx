"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/icons";
import { LiveShopBadges } from "@/components/live/live-parts";
import { useLive } from "@/components/live/live-provider";
import { SchoolMap } from "@/components/map/school-map";
import { DEPTS, type DeptId, type Place } from "@/lib/types";

type MapShop = { id: string; name: string; dept: DeptId; placeId: string; placeNote: string; catch: string };

export function MapView({ shops, places, initial }: { shops: MapShop[]; places: Place[]; initial: string | null }) {
  const [sel, setSel] = useState<string | null>(initial ?? places[0]?.id ?? null);
  const live = useLive();
  const pins = places.map((p) => {
    const here = shops.filter((s) => s.placeId === p.id);
    const depts = [...new Set(here.map((s) => s.dept))];
    const alert = here.some((s) => Object.values(live.shops[s.id]?.stock ?? {}).includes("out"));
    return { id: p.id, name: p.name, x: p.x, y: p.y, count: here.length, tone: depts.length === 1 ? `d-${depts[0]}` : undefined, alert };
  });
  const place = places.find((p) => p.id === sel);
  const here = shops.filter((s) => s.placeId === sel);
  const nowhere = shops.filter((s) => !s.placeId || !places.some((p) => p.id === s.placeId));

  return (
    <div className="mp-grid">
      <SchoolMap pins={pins} selected={sel} onSelect={setSel} />
      <div className="mp-side">
        <ul className="mp-legend" aria-label="部門の色">
          {(Object.keys(DEPTS) as DeptId[]).map((d) => (
            <li key={d} className={`d-${d}`}>
              <span aria-hidden="true" />
              {DEPTS[d].short}
            </li>
          ))}
        </ul>
        {place ? (
          <section className="mp-here" aria-live="polite">
            <h2>
              <Icon name="場所" size={20} />
              {place.name}
            </h2>
            {place.note && <p className="mp-note">{place.note}</p>}
            {here.length ? (
              <ul className="mp-list">
                {here.map((s) => (
                  <li key={s.id} className={`d-${s.dept}`}>
                    <Link href={`/shops/${s.id}`}>
                      <span className="mp-dept">{DEPTS[s.dept].short}</span>
                      <span className="mp-name">{s.name}</span>
                      {s.placeNote && <span className="mp-pnote">{s.placeNote}</span>}
                      <LiveShopBadges shopId={s.id} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mp-note">この場所のお店は、まだ決まっていません。</p>
            )}
          </section>
        ) : (
          <p className="mp-note">地図のピンを押してください。</p>
        )}
        {nowhere.length > 0 && (
          <section className="mp-nowhere">
            <h2>場所を準備中のお店</h2>
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
    </div>
  );
}
