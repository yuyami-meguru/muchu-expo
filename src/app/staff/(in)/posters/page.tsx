import type { Metadata } from "next";
import Link from "next/link";
import type { CSSProperties } from "react";
import { Sprite, type SpriteName } from "@/components/pixel/sprites";
import { Banner } from "@/components/ui/banner";
import { Card, PageHeader } from "@/components/ui/card";
import { Switch } from "@/components/ui/field";
import { allSchedule } from "@/lib/schedule";
import { SITE_URL } from "@/lib/site";
import { loadAll } from "@/lib/store";
import { areaName, deptLookup, NO_DEPT, placeKindOf, type Shop } from "@/lib/types";
import { EVENT, VENUE } from "@/lib/venue";
import { adminOnly } from "../_components/admin-only";
import { PrintButton, PrintGroupButton } from "../qr/qr-tools";
import { docPageCss, IndexDoc, placeCell, ShopListDoc, TimetableDoc } from "./docs";
import { FloorGuideSheet, floorSheets } from "./floor-guide";
import { PaperCheck } from "./paper-check";
import { asOfText, DOT_DATE, placeReader, publicQr, TONE_HEX } from "./paper";
import { PrintItem } from "./print-item";
import "./posters.css";
import "./floors.css";

export const metadata: Metadata = { title: "会場に貼るポスター" };
export const dynamic = "force-dynamic";

const PAIRS: [SpriteName, SpriteName][] = [
  ["controller", "ball"],
  ["camera", "cube"],
  ["guitar", "sneaker"],
  ["skate", "note"],
  ["paint", "controller"],
  ["cube", "skate"],
];

/**
 * 店名の長さで字の大きさと書き方を変える。10 字までは題字（緑のドット文字）、11 字からは遠くから読めるよう、ふちなしの濃い紺の太字（R9-6）。
 * いちばん長い 40 字でも 3 行に収める
 */
function nameClass(name: string) {
  const n = [...name].length;
  return n <= 6 ? "pst-name--xl" : n <= 10 ? "pst-name--l" : n <= 14 ? "pst-name--m" : n <= 22 ? "pst-name--s" : "pst-name--xs";
}

/** 1 枚目の部門の札に出さない部門（運営の部門は、お客さんに見せる「出し物の分け方」ではないので） */
const isStaffDept = (name: string) => /実行委員|運営/.test(name);

const LOGO_ALT = "学校法人鶴学園 広島工業大学高等学校［通信制課程］";

/** 控えの紙の種類（名前付きのページと、2 ページ目からの欄外の題） */
const DOC_PAGES = [
  { page: "pdoc-shops", title: "お店・出し物の一覧（受付・本部の控え）" },
  { page: "pdoc-time", title: "タイムテーブル（受付・本部の控え）" },
  { page: "pdoc-index", title: "お店・出し物の場所" },
];

/** ポスターの「メニュー・値段・売り切れはスマホで」の所。見る・聴く出し物や、品物の無いお店には合う言い方で（R9-2・R5-13） */
function leadOf(shop: Shop) {
  const noun = shop.kind === "see" ? "出し物" : "お店";
  const lead = shop.menu.length > 0 ? "メニュー・値段・売り切れはスマホで" : shop.schedule.length > 0 ? "くわしい説明と当日の流れはスマホで" : "くわしい説明はスマホで";
  const feel = shop.message.trim() ? (noun === "お店" ? "（お店の思いも）" : "（出し物にこめた思いも）") : "";
  return { lead, sub: `読み取ると、この${noun}のページが開きます${feel}` };
}

/**
 * 会場に貼る紙（実行委員だけ）。どれも A4 で、お客さんに見せてよい QR だけをのせる（お店の人の QR＝かぎ入りは /staff/qr）。
 *  - ポスター：1 枚目は会場全体の案内（サイトのトップへ）、2 枚目はアンケート、3 枚目からはお店・出し物ごと（そのページへ）
 *  - フロアの案内：建物の中の階ごとに 1 枚（見取り図と、その階のお店・出し物。各階の階段の前・入口に貼る）
 *  - 受付・本部の控え：お店・出し物の一覧、タイムテーブル、場所の索引（電波がないとき・スマホを持っていない人のため）
 * 紙は実行委員が家や学校のプリンタで刷るので、余白の設定がまちまちでも 1 枚が 2 ページに割れない大きさにしてある（posters.css）。
 */
export default async function StaffPostersPage() {
  await adminOnly();
  const { shops, depts, places, areas } = await loadAll({ fresh: true });
  const dept = deptLookup(depts);
  const where = placeReader(places, areas);
  const visible = shops.filter((s) => !s.hidden);
  const hiddenCount = shops.length - visible.length;
  const host = SITE_URL.replace(/^https?:\/\//, "");
  const asOf = asOfText();
  const day = asOfText(false);

  const topQr = await publicQr(`${SITE_URL}/`);
  const surveyQr = await publicQr(`${SITE_URL}/survey`);
  const sheets = await Promise.all(
    visible.map(async (s) => ({ shop: s, d: dept(s.dept), w: where(s), svg: await publicQr(`${SITE_URL}/shops/${encodeURIComponent(s.id)}`) })),
  );
  const floors = await Promise.all(
    floorSheets(areas, places, visible).map(async (f) => {
      const path = `/map?area=${encodeURIComponent(f.area.id)}`;
      return { ...f, path, qr: await publicQr(`${SITE_URL}${path}`) };
    }),
  );
  // 1 枚目の部門の札（出しているお店・出し物がある部門だけ。運営の部門は出さない）
  const shownDepts = depts.filter((d) => !isStaffDept(d.name) && visible.some((s) => s.dept === d.id));
  // 控えの紙：部門ごとのお店（部門が消えたお店は最後に「未分類」）と、全部のお店の当日の流れ
  const groups = [...depts, { ...NO_DEPT, id: "__none" }]
    .map((d) => ({ d, list: visible.filter((s) => (d.id === "__none" ? !depts.some((x) => x.id === s.dept) : s.dept === d.id)) }))
    .filter((g) => g.list.length > 0);
  const { timed, other } = allSchedule(shops, depts);
  const byId = new Map(shops.map((s) => [s.id, s]));
  const placeOf = (id: string) => {
    const s = byId.get(id);
    return s ? placeCell(where(s)) : "";
  };

  // 刷る前の確かめ
  const unplaced = visible.filter((s) => !where(s).set);
  const emptyFloors = floors.filter((f) => f.count === 0);
  const noDesk = (["info", "aid"] as const).filter((k) => !places.some((p) => placeKindOf(p) === k));
  const posterCount = 2 + visible.length;

  return (
    <div className="st-page st-stack pst-page">
      {/* 控えの紙の欄外（題・時点・ページ番号）。時点の字が入るので、ここで作る */}
      <style dangerouslySetInnerHTML={{ __html: docPageCss(DOC_PAGES, asOf) }} />
      <div className="st-noprint st-stack">
        <PageHeader
          title="会場に貼るポスター"
          sub="会場に貼る A4 の紙です。ポスター（会場全体の案内・アンケート・お店ごと）、フロアの案内、受付・本部の控え"
          actions={<PrintButton label="ポスターを全部印刷" />}
        />
        <Banner tone="info" title="ここの QR は、お客さんに見せてよいものです">
          読み取ると、お店・出し物のページやマップが開きます（だれでも見られるページ）。お店の人が売り切れを変えるための QR は「お店の人に配る QR」の画面にあり、そちらは会場に貼らないでください。
        </Banner>

        <Card title="刷る前の確かめ">
          <ul className="pst-check">
            <li>
              ポスター：全部で <strong>{posterCount} 枚</strong>（会場全体の案内・アンケート・お店と出し物 {visible.length} 件）
            </li>
            <li>
              フロアの案内：<strong>{floors.length} 枚</strong>
              {floors.length > 0 && `（${floors.map((f) => areaName(f.area)).join("・")}）`}
            </li>
            <li>受付・本部の控え：お店・出し物の一覧、タイムテーブル、場所の索引（1 つずつ印刷）</li>
            {unplaced.length > 0 && (
              <li data-tone="warn">
                場所が未定：<strong>{unplaced.length} 件</strong>（{unplaced.map((s) => s.name).join("・")}）。ポスターには、場所の補足か「場所はスマホで」が出ます。
                <Link href="/staff/places#shop-places">お店の場所を決める</Link>
              </li>
            )}
            {emptyFloors.length > 0 && (
              <li data-tone="warn">
                お店・出し物がまだ無い階：{emptyFloors.map((f) => areaName(f.area)).join("・")}（その階の案内は、トイレ・階段だけの紙になります）
              </li>
            )}
            {noDesk.length > 0 && (
              <li data-tone="info">
                {noDesk.map((k) => (k === "info" ? "受付・本部" : "救護")).join("・")}の地図のピンがありません（場所の索引・フロアの案内に出ません）。
                <Link href="/staff/places">地図のピン</Link>
              </li>
            )}
            {hiddenCount > 0 && <li data-tone="info">非表示のお店：{hiddenCount} 件（ポスター・案内・控えに出ません）</li>}
          </ul>
          <PaperCheck />
        </Card>

        <div className="pst-how">
          <h2 className="pst-how-h">印刷のしかた</h2>
          <ul>
            <li>用紙は A4。倍率は 100%（「用紙に合わせる」にしない）。Chrome か Edge で印刷すると、向き・余白が自動で決まります。</li>
            <li>余白は「デフォルト」のままで（「最小」「なし」にしても、1 枚が 2 ページに割れない大きさにしてあります）。</li>
            <li>色の地は「背景のグラフィック」がオフでも刷られます。白黒のプリンタでも読めます。</li>
            <li>この画面を開いた時点（{asOf}）の中身です。お店の場所や名前を直したら、この画面を開き直してから刷ってください。</li>
          </ul>
          <Switch id="pst-white" label="ポスターを白い地で刷る（インク節約）" hint="水色の地は、紙いっぱいにインクを使います。白い地にすると、ふちと絵だけに色が付きます" />
        </div>

        <nav className="pst-jump" aria-label="紙の種類">
          <a href="#pst-posters">ポスター（{posterCount} 枚）</a>
          <a href="#pst-floors">フロアの案内（{floors.length} 枚）</a>
          <a href="#pst-docs">受付・本部の控え</a>
        </nav>
      </div>

      <section className="pst-sec pst-sec--posters" id="pst-posters" aria-labelledby="pst-posters-h">
        <h2 id="pst-posters-h" className="pst-sec-h st-noprint">
          ポスター（{posterCount} 枚）
        </h2>
        <div className="pst-list">
          {/* 1 枚目：会場全体の案内 */}
          <PrintItem id="pst-1" label="1 枚目・会場全体の案内">
            <section className="pst-sheet pst-sheet--top pst-sheet--venue" aria-label="会場全体の案内ポスター">
              <div className="pst-in">
                <Sprite name="controller" size={120} className="pst-sp pst-sp--a" />
                <Sprite name="guitar" size={120} className="pst-sp pst-sp--b" />
                <Sprite name="ball" size={120} className="pst-sp pst-sp--c" />
                <Sprite name="cube" size={120} className="pst-sp pst-sp--d" />
                <p className="pst-org">{EVENT.organizer}</p>
                <div className="pst-main" data-fit="会場全体の案内のポスター">
                  <h2 className="pst-title">
                    <span className="pst-title-1">エンカレ</span>
                    <span className="pst-title-2">夢中万博</span>
                  </h2>
                  <p className="pst-date">
                    {DOT_DATE} {EVENT.hours}
                    <br />
                    {VENUE.name}
                  </p>
                  <div className="pst-qr" dangerouslySetInnerHTML={{ __html: topQr }} role="img" aria-label="サイトのトップの QR コード" />
                  <p className="pst-lead">
                    売り切れ・マップ・お店の思いは、
                    <br />
                    ここから
                  </p>
                  <p className="pst-sub">この QR コードを、スマホのカメラで読み取ってください</p>
                  <ul className={shownDepts.length > 6 ? "pst-depts pst-depts--many" : "pst-depts"} aria-label="部門">
                    {shownDepts.map((d) => (
                      <li key={d.id} style={{ background: TONE_HEX[d.color] }}>
                        {d.name}
                      </li>
                    ))}
                  </ul>
                </div>
                {/* 学校のロゴは札にのせず、パンフの裏面のようにいちばん下に小さく */}
                <div className="pst-foot">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/brand/school-logo.svg" alt={LOGO_ALT} />
                  <p className="pst-url">{host}</p>
                </div>
              </div>
            </section>
          </PrintItem>

          {/* 2 枚目：アンケート（受付や出口に貼る） */}
          <PrintItem id="pst-2" label="2 枚目・アンケート">
            <section className="pst-sheet pst-sheet--top pst-sheet--survey" aria-label="アンケートのポスター">
              <div className="pst-in">
                <Sprite name="note" size={120} className="pst-sp pst-sp--a" />
                <Sprite name="paint" size={120} className="pst-sp pst-sp--c" />
                <p className="pst-org">{EVENT.organizer}</p>
                <div className="pst-main" data-fit="アンケートのポスター">
                  <h2 className="pst-title">
                    <span className="pst-title-1">エンカレ夢中万博</span>
                    <span className="pst-title-2 pst-title-survey">アンケート</span>
                  </h2>
                  <p className="pst-lead">
                    ご協力をお願いします
                    <br />
                    （1〜2 分）
                  </p>
                  <div className="pst-qr" dangerouslySetInnerHTML={{ __html: surveyQr }} role="img" aria-label="アンケートの QR コード" />
                  <p className="pst-sub">この QR コードを、スマホのカメラで読み取ってください。お名前や連絡先はうかがいません</p>
                </div>
                <div className="pst-foot">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/brand/school-logo.svg" alt={LOGO_ALT} />
                  <p className="pst-url">{host}/survey</p>
                </div>
              </div>
            </section>
          </PrintItem>

          {/* 3 枚目から：お店・出し物ごと */}
          {sheets.map(({ shop, d, w, svg }, i) => {
            const [a, b] = PAIRS[i % PAIRS.length];
            const { lead, sub } = leadOf(shop);
            const sched = shop.schedule.filter((x) => x.time.trim() || x.text.trim());
            const busy = sched.length > 0 || !!w.note || w.outside;
            return (
              <PrintItem key={shop.id} id={`pst-${i + 3}`} label={`${i + 3} 枚目・${shop.name}`}>
                <section
                  className={busy ? "pst-sheet pst-sheet--busy" : "pst-sheet"}
                  style={{ "--c": TONE_HEX[d.color] } as CSSProperties}
                  aria-label={`${shop.name}のポスター`}
                >
                  <div className="pst-in">
                    <Sprite name={a} size={120} className="pst-sp pst-sp--a" />
                    <Sprite name={b} size={120} className="pst-sp pst-sp--c" />
                    <p className="pst-brand">
                      エンカレ夢中万博　{DOT_DATE} {EVENT.hours}
                    </p>
                    <div className="pst-main" data-fit={`「${shop.name}」のポスター`}>
                      <p className="pst-dept">{d.name}</p>
                      <h2 className={`pst-name ${nameClass(shop.name)}`} data-fit={`「${shop.name}」の店名`}>
                        {shop.name}
                      </h2>
                      {shop.catch && (
                        <p className="pst-catch" data-fit={`「${shop.name}」のひとこと`}>
                          {shop.catch}
                        </p>
                      )}
                      <div className="pst-qr" dangerouslySetInnerHTML={{ __html: svg }} role="img" aria-label={`${shop.name}のページの QR コード`} />
                      <p className="pst-lead">{lead}</p>
                      <p className="pst-sub">{sub}</p>
                      {w.set || w.note ? (
                        <div className="pst-place">
                          <p className="pst-place-1" data-fit={`「${shop.name}」の場所`}>
                            場所：{w.set ? w.label : w.note}
                          </p>
                          {w.set && w.note && (
                            <p className="pst-place-2" data-fit={`「${shop.name}」の場所の補足`}>
                              {w.note}
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="pst-place">
                          <p className="pst-place-1">場所はスマホで</p>
                          <p className="pst-place-2">決まりしだい、ページでお知らせします</p>
                        </div>
                      )}
                      {w.set && w.outside && <p className="pst-move">場所が変わることがあります。いまの場所はスマホで</p>}
                      {sched.length > 0 && (
                        <ul className="pst-sched" aria-label="当日の流れ">
                          {sched.slice(0, 3).map((x, j) => (
                            <li key={j}>
                              <b>{x.time}</b>
                              <span data-fit-line={`「${shop.name}」の当日の流れ（${x.time}）`}>{x.text}</span>
                            </li>
                          ))}
                          {sched.length > 3 && <li className="pst-sched-more">ほかに {sched.length - 3} つ（スマホで）</li>}
                        </ul>
                      )}
                    </div>
                    <p className="pst-url">
                      {host}/shops/{shop.id}
                    </p>
                  </div>
                </section>
              </PrintItem>
            );
          })}
        </div>
      </section>

      {/* フロアの案内（「ポスターを全部印刷」には入れない。下のボタンでまとめて、または 1 枚ずつ） */}
      <section className="pst-sec pst-sec--floors" id="pst-floors" aria-labelledby="pst-floors-h">
        <div className="st-noprint pst-sec-head">
          <h2 id="pst-floors-h" className="pst-sec-h">
            フロアの案内（{floors.length} 枚）
          </h2>
          <p className="st-muted">
            建物の中の階ごとに 1 枚。各階の階段の前と、建物の入口に貼ります。見取り図と、その階のお店・出し物・トイレをのせています（地図のピンにある物だけ）。部屋割りが変わったら、刷り直してください。
          </p>
          {floors.length > 0 && <PrintGroupButton group="floors" label="フロアの案内を全部印刷" />}
        </div>
        {floors.length === 0 ? (
          <p className="st-muted st-noprint">建物の中のフロアがありません（地図のピンの画面で足せます）。</p>
        ) : (
          <div className="pst-list pst-list--floors">
            {floors.map((f) => (
              <PrintItem key={f.area.id} id={`pfl-${f.area.id}`} group="floors" label={`フロアの案内・${areaName(f.area)}`}>
                <FloorGuideSheet sheet={f} depts={depts} host={host} asOf={day} />
              </PrintItem>
            ))}
          </div>
        )}
      </section>

      {/* 受付・本部の控え（「ポスターを全部印刷」には入れない。それぞれのボタンで印刷） */}
      <section className="pst-sec pst-docs" id="pst-docs" aria-labelledby="pst-docs-h">
        <div className="st-noprint pst-sec-head">
          <h2 id="pst-docs-h" className="pst-sec-h">
            受付・本部の控え（紙）
          </h2>
          <p className="st-muted">
            電波がないときや、スマホを持っていない人に見せる紙です。受付と本部に置いてください（場所の索引は、入口に貼ってもかまいません）。1 つずつ印刷します。余白は「デフォルト」のままで。2 ページ目からも、上に題と時点、下にページ番号が出ます。
          </p>
        </div>

        <PrintItem id="pst-doc-shops" className="pst-item--doc pst-item--pdoc-shops" label="お店・出し物の一覧" button="この紙を印刷">
          <ShopListDoc groups={groups} where={where} asOf={asOf} />
        </PrintItem>

        <PrintItem id="pst-doc-time" className="pst-item--doc pst-item--pdoc-time" label="タイムテーブル" button="この紙を印刷">
          <TimetableDoc timed={timed} other={other} placeOf={placeOf} asOf={asOf} />
        </PrintItem>

        <PrintItem id="pst-doc-index" className="pst-item--doc pst-item--pdoc-index" label="お店・出し物の場所（索引）" button="この紙を印刷">
          <IndexDoc shops={visible} places={places} areas={areas} depts={depts} where={where} asOf={asOf} />
        </PrintItem>
      </section>
    </div>
  );
}
