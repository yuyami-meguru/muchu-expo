import type { Metadata } from "next";
import { loadAll } from "@/lib/store";
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
 * どこで何をしているか。地図の上のボタンで「外」と建物の中のフロアを切り替える（トイレ・受付などの設備も）。
 * ピン・部屋の四角を押すと、その場所のお店と、どんなことをするかが出る。
 * /map?place=<id> でその場所を選んで（フロアの場所ならそのフロアで）、/map?area=<フロアの id> でそのフロアを開く（読むのは MapView）
 */
export default async function MapPage({ searchParams }: { searchParams: Promise<{ place?: string; area?: string }> }) {
  // ?place=・?area= は MapView が URL から読む（戻る・進むでも合わせるため）。ここで待つのは、ページを毎回サーバーで作るため
  await searchParams;
  const { shops, places, areas, depts } = await loadAll();
  const visible = shops
    .filter((s) => !s.hidden)
    .map((s) => ({ id: s.id, name: s.name, dept: s.dept, placeId: s.placeId, placeNote: s.placeNote, catch: s.catch, about: aboutOf(s.description) }));
  // 「外」と「知育館の中（2階・3階・4階）」のように、建物ごとの階を並べて説明する
  const inside = [...new Set(areas.map((a) => a.building))]
    .map((b) => `${b}の中（${areas.filter((a) => a.building === b).map((a) => a.floor).join("・")}）`)
    .join("、");
  return (
    <div className="mp-wrap">
      <header className="mp-head">
        <p className="mp-eyebrow">MAP</p>
        <h1 className="mp-h1">マップ</h1>
        <p className="mp-lead">
          {inside ? `「外」と${inside}を、地図の上のボタンで切り替えられます。` : ""}
          ピンや部屋の四角を押すと、そこのお店・出し物と、どんなことをするかが出ます。
        </p>
        <a href="#mp-guide" className="mp-jump">
          一覧で見る（階ごとの案内）↓
        </a>
      </header>
      <MapView shops={visible} places={places} areas={areas} depts={depts.filter((d) => visible.some((s) => s.dept === d.id))} />
      <section className="mp-access" aria-labelledby="mp-access-h">
        <h2 id="mp-access-h">会場への行き方</h2>
        <AccessMap />
      </section>
    </div>
  );
}
