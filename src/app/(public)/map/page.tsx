import type { Metadata } from "next";
import { loadAll } from "@/lib/store";
import { areaOf, OUTSIDE } from "@/lib/types";
import { AccessMap } from "@/components/access/map-buttons";
import { MapView } from "./map-view";
import "./map.css";

export const metadata: Metadata = { title: "マップ" };

/** 説明の始めの部分（地図で「どんなことをするか」を見せる。長ければ 70 字で切る） */
function aboutOf(text: string) {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > 70 ? `${t.slice(0, 69)}…` : t;
}

/**
 * どこで何をしているか。上のタブで「外」と建物の中のフロアを切り替える（トイレ・受付などの設備も）。
 * ピン・部屋の四角を押すと、その場所のお店と、どんなことをするかが下に出る。
 * /map?place=<id> でその場所を選んで（フロアの場所ならそのフロアで）、/map?area=<フロアの id> でそのフロアを開く
 */
export default async function MapPage({ searchParams }: { searchParams: Promise<{ place?: string; area?: string }> }) {
  const { place, area } = await searchParams;
  const { shops, places, areas, depts } = await loadAll();
  const visible = shops
    .filter((s) => !s.hidden)
    .map((s) => ({ id: s.id, name: s.name, dept: s.dept, placeId: s.placeId, placeNote: s.placeNote, catch: s.catch, about: aboutOf(s.description) }));
  const picked = places.find((p) => p.id === place);
  const initial = picked
    ? { area: areaOf(picked), place: picked.id }
    : { area: areas.some((a) => a.id === area) ? area! : OUTSIDE, place: null };
  return (
    <div className="mp-wrap">
      <header className="mp-head">
        <p className="mp-eyebrow">MAP</p>
        <h1 className="mp-h1">マップ</h1>
        <p className="mp-lead">「外」と建物の中のフロアを、上のボタンで切り替えられます。ピンや部屋の四角を押すと、そこのお店・出し物と、どんなことをするかが出ます。</p>
      </header>
      <MapView shops={visible} places={places} areas={areas} depts={depts.filter((d) => visible.some((s) => s.dept === d.id))} initial={initial} />
      <section className="mp-access" aria-labelledby="mp-access-h">
        <h2 id="mp-access-h">会場への行き方</h2>
        <AccessMap />
      </section>
    </div>
  );
}
