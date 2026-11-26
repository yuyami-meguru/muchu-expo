import type { Metadata } from "next";
import { RADIO_SHOP } from "@/lib/radio-shop";
import { outsideSpot } from "@/lib/outside-plan";
import { loadAll } from "@/lib/store";
import { AccessMap } from "@/components/access/map-buttons";
import { isSolo, SoloPage } from "@/components/shell/solo-page";
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
export default async function MapPage({ searchParams }: { searchParams: Promise<{ place?: string; area?: string; solo?: string }> }) {
  // ?place=・?area= は MapView が URL から読む（戻る・進むでも合わせるため）。?solo=1 はパンフの QR から開いたとき（メニューを出さない。solo-page.tsx）
  const { solo } = await searchParams;
  const { shops, places, areas, depts, outLayout } = await loadAll();
  const visible = shops
    .filter((s) => !s.hidden)
    .map((s) => ({ id: s.id, name: s.name, dept: s.dept, placeId: s.placeId, placeNote: s.placeNote, catch: s.catch, about: aboutOf(s.description) }));
  // 「外」と「知育館の中（2階・3階・4階）」のように、建物ごとの階を並べて説明する
  // 放送局（radio のお店）が非表示のあいだは、その場所（放送ブース）も、ほかにお店・出し物が無ければ一覧に出さない
  const radioShop = shops.find((s) => s.id === RADIO_SHOP);
  const radioPlace = radioShop?.hidden ? radioShop.placeId : undefined;
  // v0.21.0：会場マップに置き場所の無い前の外のピン（「校舎の教室」など。outsideSpot が null）も、お店・出し物が無ければ一覧に出さない
  // （「未定」と並ぶだけで、お客さんには探しようがないので）。実行委員が置き直したピン・お店のあるピンは出す
  const used = (id: string) => visible.some((s) => s.placeId === id);
  const shownPlaces = places.filter((p) => used(p.id) || (p.id !== radioPlace && outsideSpot(p) !== null));
  const inside = [...new Set(areas.map((a) => a.building))]
    .map((b) => `${b}の中（${areas.filter((a) => a.building === b).map((a) => a.floor).join("・")}）`)
    .join("、");
  return (
    <div className="mp-wrap">
      <SoloPage on={isSolo(solo)} />
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
      <MapView layout={outLayout} shops={visible} places={shownPlaces} areas={areas} depts={depts.filter((d) => visible.some((s) => s.dept === d.id))} />
      <section className="mp-access" aria-labelledby="mp-access-h">
        <h2 id="mp-access-h">会場への行き方</h2>
        <AccessMap />
      </section>
    </div>
  );
}
