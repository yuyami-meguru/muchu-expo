import type { Metadata } from "next";
import { loadAll } from "@/lib/store";
import { AccessMap } from "@/components/access/map-buttons";
import { MapView } from "./map-view";
import "./map.css";

export const metadata: Metadata = { title: "マップ" };

/** どの部門がどこにあるか。ピンを押すと、その場所のお店が下に出る */
export default async function MapPage({ searchParams }: { searchParams: Promise<{ place?: string }> }) {
  const { place } = await searchParams;
  const { shops, places, depts } = await loadAll();
  const visible = shops
    .filter((s) => !s.hidden)
    .map((s) => ({ id: s.id, name: s.name, dept: s.dept, placeId: s.placeId, placeNote: s.placeNote, catch: s.catch }));
  return (
    <div className="mp-wrap">
      <header className="mp-head">
        <p className="mp-eyebrow">MAP</p>
        <h1 className="mp-h1">マップ</h1>
        <p className="mp-lead">ピンを押すと、その場所のお店・出し物が出ます。赤い点は売り切れが出ている場所です。</p>
      </header>
      <MapView shops={visible} places={places} depts={depts.filter((d) => visible.some((s) => s.dept === d.id))} initial={places.some((p) => p.id === place) ? place! : null} />
      <section className="mp-access" aria-labelledby="mp-access-h">
        <h2 id="mp-access-h">会場への行き方</h2>
        <AccessMap />
      </section>
    </div>
  );
}
