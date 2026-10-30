"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
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
/** 種類の名前（「トイレ」の場所に「（トイレ）」と重ねて読ませない） */
const kindNote = (p: Pick<Place, "name" | "kind">) => {
  const k = placeKindOf(p);
  return k === "spot" || KIND[k].label === p.name ? "" : KIND[k].label;
};
const smooth = (): ScrollBehavior => (matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth");

type View = { area: string; place: string | null; missing: boolean };

/** URL（?place=・?area=）から、開く面と選ぶ場所。知らない場所なら外の地図にして missing（「見つかりませんでした」を出す） */
function viewOf(q: { get(name: string): string | null }, places: Place[], areas: Area[]): View {
  const place = q.get("place");
  const area = q.get("area");
  // 消したフロアに残ったピンは、地図に出せないので「見つかりませんでした」と同じに
  const picked = place ? places.find((p) => p.id === place && (areaOf(p) === OUTSIDE || areas.some((a) => a.id === areaOf(p)))) : undefined;
  if (picked) return { area: areaOf(picked), place: picked.id, missing: false };
  return { area: area && areas.some((a) => a.id === area) ? area : OUTSIDE, place: null, missing: !!place };
}

/**
 * 校内マップ。上のボタンで「外」と、建物の中のフロア（知育館 2階など）を切り替える。
 * ピン・部屋の四角（または「この階の場所」）を押すと、その場所のお店・出し物と、どんなことをするかが出る。
 * 外の地図の建物のピンを押すと、その建物のフロアへ移れる（建物のピンがまだ無ければ、外の地図の下に「○○の中を見る」）。
 * いちばん下の「階ごとの案内」は、全部の面の「どこで何を」の一覧（パンフレットの代わり）。
 * 選んだ面と場所は URL（?area=・?place=）にも入れる（送る・戻るで同じ所が開く。戻る・進む・下の「マップ」で URL が変わったら、それに合わせる）。
 * 地図の上の部屋・ピンは Tab で通らない（同じものを下の一覧で選べる。読み上げも一覧で）。選んだら、選んだ場所の見出しへフォーカスを移し、短い一文で知らせる
 */
export function MapView({ shops, places, areas, depts }: { shops: MapShop[]; places: Place[]; areas: Area[]; depts: Dept[] }) {
  const dept = deptLookup(depts);
  const live = useLive();
  const phase = usePhase();
  // 開催前は、部屋にお店が無くても「ありません」と言い切らない（「未定」）
  const before = phase === "before";
  const params = useSearchParams();
  const qs = params.toString();
  const [view, setView] = useState<View>(() => viewOf(params, places, areas));
  const [seenQs, setSeenQs] = useState(qs);
  if (qs !== seenQs) {
    setSeenQs(qs);
    setView(viewOf(params, places, areas));
  }
  const { area, place: sel, missing } = view;
  const [showFac, setShowFac] = useState(true);
  const [status, setStatus] = useState("");

  // URL で面や場所を指して開いたときは、地図が見える所まで下げる（戻るで来たときなど、もう下にいるなら動かさない）
  useEffect(() => {
    if (!/[?&](place|area)=/.test(window.location.search) || window.scrollY > 10) return;
    document.getElementById("mp-areas")?.scrollIntoView({ block: "start" });
  }, []);

  const cur = areas.find((a) => a.id === area);
  const base: MapBase = cur ? { kind: "floor", plan: cur.plan, name: areaName(cur) } : { kind: "outside" };
  // 建物が 1 つだけなら、ボタンは「2階」のように短く（建物の名前は地図の左上と、選んだ場所の欄に出す）
  const buildings = [...new Set(areas.map((a) => a.building))];
  const short = buildings.length === 1;
  const gateOf = (id: string) => places.find((p) => areaOf(p) === id && placeKindOf(p) === "gate");
  const tabs = [
    { id: OUTSIDE, full: "外", main: "外", sub: "" },
    ...areas.map((a) => ({ id: a.id, full: areaName(a), main: short ? a.floor || areaName(a) : areaName(a), sub: gateOf(a.id)?.name ?? "" })),
  ];
  const nameOfArea = (id: string) => tabs.find((t) => t.id === id)?.full ?? "外";
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
    const here = shopsAt(p.id);
    if (kind !== "spot") {
      const note = kindNote(p);
      return { id: p.id, name: p.name, x: p.x, y: p.y, kind, count: here.length || undefined, label: note ? `${p.name}（${note}）` : p.name, ...box };
    }
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
      label: `${p.name}（${here.length ? `お店・出し物 ${here.length} 件` : before ? "お店・出し物は未定" : "お店・出し物なし"}${alert ? "・売り切れあり" : ""}）`,
      ...box,
    };
  }

  const inArea = places.filter((p) => areaOf(p) === area);
  const hasFac = inArea.some((p) => placeKindOf(p) !== "spot");
  const pins = inArea.filter((p) => showFac || placeKindOf(p) === "spot" || p.id === sel).map(pinOf);
  const spotPins = pins.filter((p) => p.kind === "spot");
  const withShops = spotPins.filter((p) => p.count);
  const empty = spotPins.filter((p) => !p.count);
  const facPins = pins.filter((p) => p.kind !== "spot");
  // 横にスクロールする見取り図で、はじめに見せる所：お店のある部屋、無ければ玄関
  const focusIds = withShops.length ? withShops.map((p) => p.id) : facPins.filter((p) => p.kind === "gate").map((p) => p.id);

  /**
   * 面・場所を選ぶ。URL も書きかえる（サーバーには聞かない）。
   * scroll：地図が見える所まで上げる（下の一覧・案内から選んだとき）。focus：選んだ場所の見出し（here）か、面のボタン（area）へ
   */
  function go(nextArea: string, place: string | null, how: { scroll?: boolean; focus?: "here" | "area" } = {}) {
    const target = place ? places.find((p) => p.id === place) : undefined;
    flushSync(() => {
      setView({ area: nextArea, place, missing: false });
      // 設備を選んだら、設備の印を出す（「トイレ・受付などを表示」を外していても地図に出るように）
      if (target && placeKindOf(target) !== "spot") setShowFac(true);
      setStatus(target ? statusOf(target, nextArea) : `${nameOfArea(nextArea)}の地図にしました。`);
    });
    try {
      const q = place ? `?place=${encodeURIComponent(place)}` : nextArea !== OUTSIDE ? `?area=${encodeURIComponent(nextArea)}` : "";
      window.history.replaceState(null, "", `/map${q}`);
    } catch {
      // URL を変えられなくても、選ぶことはできる
    }
    // 画面の部品は id で探す（選んだあとの見出し・ボタンは、上の flushSync で描き終わっている）
    if (how.scroll) document.getElementById("mp-areas")?.scrollIntoView({ block: "start", behavior: smooth() });
    const head = how.focus === "here" ? document.getElementById("mp-here-h") : null;
    if (head) {
      head.focus({ preventScroll: true });
      if (!how.scroll) head.scrollIntoView({ block: "nearest", behavior: smooth() });
    }
    if (how.focus === "area") document.getElementById(`mp-area-${nextArea}`)?.focus({ preventScroll: true });
  }

  /** 選んだときに読み上げる短い一文 */
  function statusOf(p: Place, inAreaId: string) {
    const n = shopsAt(p.id).length;
    const what = n ? `お店・出し物は ${n} 件です。` : placeKindOf(p) !== "spot" ? "" : before ? "お店・出し物は未定です。" : "お店・出し物はありません。";
    return `${nameOfArea(inAreaId)}の「${p.name}」を選びました。${what}`;
  }

  const place = places.find((p) => p.id === sel && areaOf(p) === area);
  const placeKind = place ? placeKindOf(place) : "spot";
  const here = place ? shopsAt(place.id) : [];
  /** 建物のピンなら、その建物のフロア（フロアの「建物の名前」がピンの名前と同じもの） */
  const floorsOf = (p: Place) => areas.filter((a) => a.building === p.name);
  // 外の地図に建物のピンが無い建物（外から中へ移れないので、外の地図の下にボタンを出す）
  const pinned = new Set(places.filter((p) => areaOf(p) === OUTSIDE && placeKindOf(p) === "building").map((p) => p.name));
  const inside = buildings
    .filter((b) => !pinned.has(b))
    .map((b) => ({ building: b, floors: tabs.filter((t) => areas.some((a) => a.id === t.id && a.building === b)) }));
  const nowhere = shops.filter((s) => !s.placeId || !places.some((p) => p.id === s.placeId));
  const usedDepts = depts.filter((d) => shops.some((s) => s.dept === d.id && places.some((p) => p.id === s.placeId)));
  const kindNoteHere = place ? kindNote(place) : "";

  /** 何も選んでいないときの案内（時期と、この面にお店があるかで言い分ける） */
  const prompt = !cur
    ? "地図のピンか、下の「外の場所」を押すと、そこのお店・出し物が出ます。"
    : !inArea.length
      ? "この階には、まだ場所の印がありません。"
      : withShops.length
        ? "色の付いた部屋か、下の「この階の場所」を押すと、そこのお店・出し物が出ます。"
        : before
          ? "この階のお店・出し物は、まだ決まっていません。決まりしだい、この地図でお知らせします。"
          : "この階には、お店・出し物はありません。トイレなどの場所は、地図と下の一覧で見られます。";

  /** 場所の一覧の 1 行（押すと地図でその場所を選ぶ） */
  const placeButton = (p: MapPin & { kind: PlaceKind }) => {
    const note = p.kind === "spot" ? "" : KIND[p.kind].label === p.name ? "" : KIND[p.kind].label;
    return (
      <li key={p.id}>
        <button type="button" className={cx("mp-place", p.tone)} aria-pressed={sel === p.id} onClick={() => go(area, p.id, { scroll: true, focus: "here" })}>
          <span className={cx("mp-glyph", p.kind !== "spot" && "mp-glyph--fac", p.multi && "mp-glyph--multi")} aria-hidden="true">
            <span>{p.kind !== "spot" ? KIND[p.kind].mark : p.mark}</span>
          </span>
          <span className="mp-place-name">
            {p.name}
            {note && <span className="sr-only">（{note}）</span>}
          </span>
          {p.kind === "spot" ? (
            <span className="mp-place-n">{p.count ? `${p.count} 件` : before ? "未定" : "なし"}</span>
          ) : (
            !!p.count && <span className="mp-place-n">{p.count} 件</span>
          )}
          {p.alert && <span className="mp-place-x">× 売り切れあり</span>}
        </button>
      </li>
    );
  };

  const listed = [...withShops, ...facPins];
  return (
    <>
      <div className={cx("mp-grid", cur ? "mp-grid--floor" : "mp-grid--out")}>
        {/* 外・フロアの切り替え（せまい画面では折り返して、全部のボタンが見えるように） */}
        <nav className="mp-areas" id="mp-areas" aria-label="外・フロアの切り替え">
          {tabs.map((t) => (
            <button
              key={t.id}
              id={`mp-area-${t.id}`}
              type="button"
              className="mp-area"
              aria-pressed={area === t.id}
              aria-label={t.sub ? `${t.full}（${t.sub}）` : t.full}
              onClick={() => go(t.id, null)}
            >
              <span className="mp-area-main">{t.main}</span>
              {t.sub && <span className="mp-area-sub">{t.sub}</span>}
            </button>
          ))}
        </nav>

        <div className="mp-map">
          <SchoolMap
            pins={pins}
            selected={sel}
            onSelect={(id) => go(area, id, { focus: "here" })}
            base={base}
            label={cur ? `${areaName(cur)}の地図` : "会場の地図（外）"}
            caption={cur ? areaName(cur) : "外"}
            focusIds={focusIds}
            tabbable={false}
          />
          {!cur &&
            inside.map(({ building, floors }) => (
              <div key={building} className="mp-inside">
                <p className="mp-inside-h">
                  <Icon name="場所" size={18} />
                  {building}の中を見る
                </p>
                <div className="mp-inside-btns">
                  {floors.map((t) => (
                    <button key={t.id} type="button" className="mp-floor-btn" onClick={() => go(t.id, null, { scroll: true, focus: "area" })}>
                      {t.main}
                      {t.sub && <small>（{t.sub}）</small>} ▶
                    </button>
                  ))}
                </div>
              </div>
            ))}
        </div>

        {/* 選んだ場所（読み上げは下の短い一文で。ここは長いので aria-live にしない） */}
        <section className={cx("mp-here", !place && !missing && "mp-here--empty")} aria-labelledby={place ? "mp-here-h" : undefined} aria-label={place ? undefined : "選んだ場所"}>
          {place ? (
            <>
              <p className="mp-where">{cur ? areaName(cur) : "外"}</p>
              <h2 id="mp-here-h" tabIndex={-1}>
                {placeKind === "spot" ? (
                  <Icon name="場所" size={20} />
                ) : (
                  <span className="mp-fac" aria-hidden="true">
                    {KIND[placeKind].mark}
                  </span>
                )}
                {place.name}
              </h2>
              {kindNoteHere && <p className="mp-kind">{kindNoteHere}</p>}
              {place.note && <p className="mp-note">{place.note}</p>}
              {placeKind === "building" &&
                (floorsOf(place).length ? (
                  <div className="mp-floors">
                    <p className="mp-note">中のフロアを見る：</p>
                    {floorsOf(place).map((a) => (
                      <button key={a.id} type="button" className="mp-floor-btn" onClick={() => go(a.id, null, { scroll: true, focus: "area" })}>
                        {a.floor} ▶
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="mp-note">この建物のフロアの案内は、まだありません。</p>
                ))}
              {here.length > 0 ? (
                <ShopList shops={here} dept={dept} />
              ) : (
                placeKind === "spot" && (
                  <p className="mp-note">
                    {before ? "この場所のお店・出し物は未定です。決まりしだいお知らせします。" : "この場所には、お店・出し物はありません。"}
                  </p>
                )
              )}
            </>
          ) : (
            <>
              {missing && (
                <p className="mp-missing">
                  お探しの場所は、地図に見つかりませんでした（場所が変わったのかもしれません）。お店・出し物のページで、いまの場所をご確認ください。
                </p>
              )}
              <p className="mp-note mp-prompt">{prompt}</p>
            </>
          )}
        </section>

        {/* この面の場所（ピンが小さい・重なっているときも、ここから選べる）。お店の無い場所はたたむ */}
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
          {listed.length > 0 && (
            <ul>
              {listed.map(placeButton)}
            </ul>
          )}
          {empty.length > 0 && (
            <details className="mp-empty">
              <summary>
                {before ? "ほかの部屋・場所" : "お店・出し物のない部屋・場所"}（{empty.length}）
              </summary>
              <ul>
                {empty.map(placeButton)}
              </ul>
            </details>
          )}
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
            {cur && (
              <>
                <div>
                  <dt>
                    <span className="mp-swatch mp-swatch--has" aria-hidden="true" />
                  </dt>
                  <dd>色の付いた部屋：お店・出し物がある部屋（色は部門）</dd>
                </div>
                <div>
                  <dt>
                    <span className="mp-swatch" aria-hidden="true" />
                  </dt>
                  <dd>うすい枠の部屋：{before ? "お店・出し物がまだ決まっていない部屋" : "お店・出し物のない部屋"}（押すと名前が出ます）</dd>
                </div>
                <div>
                  <dt>
                    <span className="mp-swatch mp-swatch--on" aria-hidden="true" />
                  </dt>
                  <dd>太い枠：いま選んでいる場所</dd>
                </div>
              </>
            )}
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
            {!before && (
              <div>
                <dt>
                  <span className="mp-x" aria-hidden="true">
                    ×
                  </span>
                </dt>
                <dd>売り切れが出ている場所</dd>
              </div>
            )}
          </dl>
        </section>
      </div>

      <p className="sr-only" role="status">
        {status}
      </p>

      {/* 階ごとの案内：全部の面の「どこで何を」（パンフレットの代わりに読める一覧） */}
      <section className="mp-guide" id="mp-guide" aria-labelledby="mp-guide-h">
        <h2 id="mp-guide-h">階ごとの案内（どこで何をしているか）</h2>
        <p className="mp-note">場所の名前を押すと、地図でその場所を見られます。お店・出し物の名前を押すと、くわしいページへ。</p>
        <div className="mp-guide-areas">
          {tabs.map((t) => {
            const list = places.filter((p) => areaOf(p) === t.id && placeKindOf(p) !== "building" && shopsAt(p.id).length);
            const fac = places.filter((p) => areaOf(p) === t.id && placeKindOf(p) !== "spot" && placeKindOf(p) !== "building" && !shopsAt(p.id).length);
            if (t.id === OUTSIDE && !list.length && !fac.length) return null;
            return (
              <div key={t.id} className="mp-guide-area">
                <h3>{t.sub ? `${t.full}（${t.sub}）` : t.full}</h3>
                {list.map((p) => (
                  <div key={p.id} className="mp-guide-place">
                    <button type="button" className="mp-guide-where" onClick={() => go(t.id, p.id, { scroll: true, focus: "here" })}>
                      <Icon name="場所" size={16} />
                      {p.name}
                    </button>
                    <ShopList shops={shopsAt(p.id)} dept={dept} compact />
                  </div>
                ))}
                {!list.length && <p className="mp-guide-none">{before ? "お店・出し物：未定" : "お店・出し物はありません"}</p>}
                {fac.length > 0 && (
                  <p className="mp-guide-fac">
                    {fac.map((p, i) => (
                      <span key={p.id}>
                        {i > 0 && "・"}
                        <button type="button" className="mp-guide-facbtn" onClick={() => go(t.id, p.id, { scroll: true, focus: "here" })}>
                          {p.name}
                        </button>
                      </span>
                    ))}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {nowhere.length > 0 && (
        <section className="mp-nowhere" aria-labelledby="mp-nowhere-h">
          <h2 id="mp-nowhere-h">{before ? "場所が決まっていないお店・出し物" : "地図に場所が出ていないお店・出し物"}</h2>
          <p className="mp-note">{before ? "場所は決まりしだいお知らせします。" : "くわしい場所は、それぞれのページをご覧ください。"}</p>
          <ul>
            {nowhere.map((s) => (
              <li key={s.id}>
                <Link href={`/shops/${s.id}`}>{s.name}</Link>
                {s.placeNote && <span className="mp-pnote">{s.placeNote}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
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
