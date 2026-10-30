import type { Metadata } from "next";
import type { CSSProperties, ReactNode } from "react";
import QRCode from "qrcode";
import { Sprite, type SpriteName } from "@/components/pixel/sprites";
import { Banner } from "@/components/ui/banner";
import { PageHeader } from "@/components/ui/card";
import { allSchedule } from "@/lib/schedule";
import { SITE_URL } from "@/lib/site";
import { loadAll } from "@/lib/store";
import { NO_DEPT, deptLookup, type Tone, placeLabeler } from "@/lib/types";
import { EVENT, VENUE } from "@/lib/venue";
import { adminOnly } from "../_components/admin-only";
import { PrintButton, PrintOneButton } from "../qr/qr-tools";
import "./posters.css";

export const metadata: Metadata = { title: "会場に貼るポスター" };
export const dynamic = "force-dynamic";

// 印刷はいつも明るい色で（画面がダークモードでも同じ紙になるように、部門の色をここで決める）
const TONE_HEX: Record<Tone, string> = {
  blue: "#1f4fb0",
  orange: "#c64d0c",
  red: "#b8321f",
  purple: "#6a43a8",
  green: "#2f7a22",
  teal: "#0b7068",
  pink: "#b02a68",
  brown: "#7a5230",
};
const PAIRS: [SpriteName, SpriteName][] = [
  ["controller", "ball"],
  ["camera", "cube"],
  ["guitar", "sneaker"],
  ["skate", "note"],
  ["paint", "controller"],
  ["cube", "skate"],
];

async function qr(url: string) {
  return QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#1f2547", light: "#ffffff" } });
}

/** 店名の長さで文字の大きさを変える（1 行〜2 行に収める） */
function nameSize(name: string) {
  const n = [...name].length;
  return n <= 6 ? "11cqw" : n <= 10 ? "8.4cqw" : n <= 14 ? "6.6cqw" : "5.4cqw";
}

/** 控えの紙の「○月○日 13:05 時点」（日本時間） */
function asOfText() {
  const t = new Date(Date.now() + 9 * 3600_000);
  return `${t.getUTCMonth() + 1}月${t.getUTCDate()}日 ${t.getUTCHours()}:${String(t.getUTCMinutes()).padStart(2, "0")} 時点`;
}

/** 印刷の 1 まい（ポスター 1 枚・控えの紙 1 つ）。画面では上に「○ ページ目」と［この 1 枚だけ印刷］を出す */
function PrintItem({ id, label, button, className, children }: { id: string; label: string; button?: string; className?: string; children: ReactNode }) {
  return (
    <div id={id} className={className ? `pst-item ${className}` : "pst-item"} data-print-unit>
      <div className="pst-bar st-noprint">
        <span className="pst-bar-l">{label}</span>
        <PrintOneButton target={id} label={button} />
      </div>
      {children}
    </div>
  );
}

const LOGO_ALT = "学校法人鶴学園 広島工業大学高等学校［通信制課程］";

/**
 * 会場に貼る、お客さん用の QR ポスター（実行委員だけ）。A4 縦 1 枚ずつ。
 * 1 枚目は会場全体の案内（サイトのトップへ）、2 枚目はアンケート、3 枚目からはお店ごと（そのお店のページへ）。
 * お店の人が売り切れを変える「お店の QR」（/staff/qr）とは別物で、こちらはお客さんに見せてよい。
 * いちばん下に、受付・本部に置く控えの紙（お店・出し物の一覧、タイムテーブル）。電波がないとき・スマホがない人のため。
 */
export default async function StaffPostersPage() {
  await adminOnly();
  const { shops, depts, places, areas } = await loadAll({ fresh: true });
  const dept = deptLookup(depts);
  const where = placeLabeler(areas);
  const placeName = Object.fromEntries(places.map((p) => [p.id, where(p)]));
  const visible = shops.filter((s) => !s.hidden);
  const hiddenCount = shops.length - visible.length;
  const topQr = await qr(`${SITE_URL}/`);
  const surveyQr = await qr(`${SITE_URL}/survey`);
  const sheets = await Promise.all(
    visible.map(async (s) => ({ shop: s, d: dept(s.dept), svg: await qr(`${SITE_URL}/shops/${encodeURIComponent(s.id)}`) })),
  );
  const host = SITE_URL.replace(/^https?:\/\//, "");
  // 1 枚目の部門の札（出しているお店がある部門だけ）
  const shownDepts = depts.filter((d) => visible.some((s) => s.dept === d.id));
  // 控えの紙：部門ごとのお店（部門が消えたお店は最後に「未分類」）と、全部のお店の当日の流れ
  const groups = [...depts, { ...NO_DEPT, id: "__none" }]
    .map((d) => ({ d, list: visible.filter((s) => (d.id === "__none" ? !depts.some((x) => x.id === s.dept) : s.dept === d.id)) }))
    .filter((g) => g.list.length > 0);
  const { timed, other } = allSchedule(shops, depts);
  const asOf = asOfText();

  return (
    <div className="st-page st-stack pst-page">
      <div className="st-noprint st-stack">
        <PageHeader
          title="会場に貼るポスター"
          sub="会場に貼る A4 のポスターです。1 枚目は会場全体の案内、2 枚目はアンケート、3 枚目からはお店ごと"
          actions={<PrintButton label="ポスターを全部印刷" />}
        />
        <Banner tone="info" title="これは、お客さんに見せてよい QR です">
          読み取ると、そのお店のメニュー・値段・売り切れ・お店の思いが見られます（だれでも見られるページ）。
          お店の人が売り切れを変えるための QR は「お店の QR」の画面にあり、そちらはお客さんに見せないでください。
          {hiddenCount > 0 && ` 非表示のお店（${hiddenCount} 店）のポスターは出していません。`}
        </Banner>
        <p className="st-muted">
          印刷の設定：用紙 A4・縦、余白なし（または「最小」）、「背景のグラフィック」をオンにすると水色の地も出ます。受付・本部に置く控えの紙（お店・出し物の一覧、タイムテーブル）は
          <a href="#pst-docs">いちばん下</a>にあります。
        </p>
      </div>

      <div className="pst-list">
        {/* 1 枚目：会場全体の案内 */}
        <PrintItem id="pst-1" label="1 ページ目・会場全体の案内">
          <section className="pst-sheet pst-sheet--top pst-sheet--venue" aria-label="会場全体の案内ポスター">
            <div className="pst-in">
              <Sprite name="controller" size={120} className="pst-sp pst-sp--a" />
              <Sprite name="guitar" size={120} className="pst-sp pst-sp--b" />
              <Sprite name="ball" size={120} className="pst-sp pst-sp--c" />
              <Sprite name="cube" size={120} className="pst-sp pst-sp--d" />
              <p className="pst-org">{EVENT.organizer}</p>
              <div className="pst-main">
                <h2 className="pst-title">
                  <span className="pst-title-1">エンカレ</span>
                  <span className="pst-title-2">夢中万博</span>
                </h2>
                <p className="pst-date">
                  2026.11.28（土） {EVENT.hours}
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
        <PrintItem id="pst-2" label="2 ページ目・アンケート">
          <section className="pst-sheet pst-sheet--top pst-sheet--survey" aria-label="アンケートのポスター">
            <div className="pst-in">
              <Sprite name="note" size={120} className="pst-sp pst-sp--a" />
              <Sprite name="paint" size={120} className="pst-sp pst-sp--c" />
              <p className="pst-org">{EVENT.organizer}</p>
              <div className="pst-main">
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

        {/* 3 枚目から：お店ごと */}
        {sheets.map(({ shop, d, svg }, i) => {
          const [a, b] = PAIRS[i % PAIRS.length];
          const place = placeName[shop.placeId] || shop.placeNote;
          return (
            <PrintItem key={shop.id} id={`pst-${i + 3}`} label={`${i + 3} ページ目・${shop.name}`}>
              <section className="pst-sheet" style={{ "--c": TONE_HEX[d.color] } as CSSProperties} aria-label={`${shop.name}のポスター`}>
                <div className="pst-in">
                  <Sprite name={a} size={120} className="pst-sp pst-sp--a" />
                  <Sprite name={b} size={120} className="pst-sp pst-sp--c" />
                  <p className="pst-brand">エンカレ夢中万博　2026.11.28（土）{EVENT.hours}</p>
                  <div className="pst-main">
                    <p className="pst-dept">{d.name}</p>
                    <h2 className="pst-name" style={{ fontSize: nameSize(shop.name) }}>
                      {shop.name}
                    </h2>
                    {shop.catch && <p className="pst-catch">{shop.catch}</p>}
                    <div className="pst-qr" dangerouslySetInnerHTML={{ __html: svg }} role="img" aria-label={`${shop.name}のページの QR コード`} />
                    <p className="pst-lead">メニュー・値段・売り切れはスマホで</p>
                    <p className="pst-sub">読み取ると、このお店のページが開きます（お店の思いも）</p>
                    {place && <p className="pst-place">場所：{place}</p>}
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

      {/* 受付・本部の控え（「ポスターを全部印刷」には入れない。それぞれのボタンで印刷） */}
      <section className="pst-docs" id="pst-docs" aria-labelledby="pst-docs-h">
        <div className="st-noprint">
          <h2 id="pst-docs-h" className="pst-docs-h">
            受付・本部の控え（紙）
          </h2>
          <p className="st-muted">
            電波がないときや、スマホを持っていない人に見せる紙です。会場には貼らず、受付と本部に置いてください。「ポスターを全部印刷」には入りません（下のボタンで 1 つずつ印刷。余白の設定は「デフォルト」のままで）。内容は、この画面を開いた時点のものです。
          </p>
        </div>

        <PrintItem id="pst-doc-shops" className="pst-item--doc" label="お店・出し物の一覧" button="この紙を印刷">
          <article className="pst-doc" aria-label="お店・出し物の一覧（受付・本部の控え）">
            <header className="pst-doc-head">
              <p className="pst-doc-kicker">受付・本部の控え ・ {asOf}</p>
              <h3 className="pst-doc-title">エンカレ夢中万博　お店・出し物の一覧</h3>
              <p className="pst-doc-meta">
                2026.11.28（土） {EVENT.hours} ・ {VENUE.name} ・ 値段は予定です
              </p>
            </header>
            {groups.length === 0 && <p>出しているお店はまだありません。</p>}
            {groups.map(({ d, list }) => (
              <section key={d.id} className="pst-doc-sec" style={{ "--c": TONE_HEX[d.color] } as CSSProperties}>
                <h4 className="pst-doc-h">
                  {d.name}
                  <small>{list.length} 店</small>
                </h4>
                <table className="pst-doc-table pst-doc-table--shops">
                  <thead>
                    <tr>
                      <th scope="col">お店・出し物</th>
                      <th scope="col">場所</th>
                      <th scope="col">メニューと値段</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((s) => (
                      <tr key={s.id}>
                        <th scope="row">
                          {s.name}
                          {s.catch && <small>{s.catch}</small>}
                        </th>
                        <td>{placeName[s.placeId] ? `${placeName[s.placeId]}${s.placeNote ? `（${s.placeNote}）` : ""}` : s.placeNote || "場所は未定"}</td>
                        <td>
                          {s.menu.length ? (
                            <ul className="pst-doc-menu">
                              {s.menu.map((m) => (
                                <li key={m.id}>
                                  <span>{m.name}</span>
                                  <span>{m.price || "値段は未定"}</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            ))}
          </article>
        </PrintItem>

        <PrintItem id="pst-doc-time" className="pst-item--doc" label="タイムテーブル" button="この紙を印刷">
          <article className="pst-doc" aria-label="タイムテーブル（受付・本部の控え）">
            <header className="pst-doc-head">
              <p className="pst-doc-kicker">受付・本部の控え ・ {asOf}</p>
              <h3 className="pst-doc-title">エンカレ夢中万博　タイムテーブル</h3>
              <p className="pst-doc-meta">
                2026.11.28（土） {EVENT.hours} ・ {VENUE.name} ・ 時間は変わることがあります
              </p>
            </header>
            {timed.length === 0 && other.length === 0 && <p>時間の決まった出し物は、まだありません。</p>}
            {timed.length > 0 && (
              <table className="pst-doc-table pst-doc-table--time">
                <thead>
                  <tr>
                    <th scope="col">時刻</th>
                    <th scope="col">すること</th>
                    <th scope="col">お店・出し物</th>
                  </tr>
                </thead>
                <tbody>
                  {timed.map((r, i) => (
                    <tr key={i} style={{ "--c": TONE_HEX[r.color as Tone] ?? TONE_HEX.brown } as CSSProperties}>
                      <td className="pst-doc-time">{r.time}</td>
                      <td>{r.text}</td>
                      <td>
                        {r.deptShort} ・ {r.shopName}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {other.length > 0 && (
              <>
                <h4 className="pst-doc-h">時刻がまだのもの・一日中</h4>
                <table className="pst-doc-table pst-doc-table--time">
                  <thead>
                    <tr>
                      <th scope="col">時刻</th>
                      <th scope="col">すること</th>
                      <th scope="col">お店・出し物</th>
                    </tr>
                  </thead>
                  <tbody>
                    {other.map((r, i) => (
                      <tr key={i} style={{ "--c": TONE_HEX[r.color as Tone] ?? TONE_HEX.brown } as CSSProperties}>
                        <td className="pst-doc-time">{r.time || "—"}</td>
                        <td>{r.text}</td>
                        <td>
                          {r.deptShort} ・ {r.shopName}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </article>
        </PrintItem>
      </section>
    </div>
  );
}
