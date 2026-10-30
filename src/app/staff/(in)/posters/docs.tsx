import type { CSSProperties } from "react";
import type { TimedRow } from "@/lib/schedule";
import { areaName, deptLookup, PLACE_KINDS, placeKindOf, type Area, type Dept, type Place, type PlaceKind, type Shop, type Tone } from "@/lib/types";
import { EVENT, VENUE } from "@/lib/venue";
import { cssString, DOT_DATE, isFacility, TONE_HEX, type PlaceInfo } from "./paper";

/*
 * 受付・本部の控え（紙）：お店・出し物の一覧、タイムテーブル、場所の索引。
 * 電波がないとき・スマホを持っていない人に見せる。会場には貼らない（索引は入口に貼ってもよい）。
 * 2 ページ目からも、紙の上に題と「○時点」、下にページ番号が出る（@page の欄外。下の docPageCss）。
 */

type Where = (shop: Pick<Shop, "placeId" | "placeNote">) => PlaceInfo;

/** 場所の欄の字：「知育館 3階・301 教室 ／ 補足」（R5-34）。地図のピンが未定なら、補足か「未定」 */
export function placeCell(w: PlaceInfo) {
  if (w.set) return w.note ? `${w.label} ／ ${w.note}` : w.label;
  return w.note || "未定";
}

/** 控えの紙の欄外（題・時点・ページ番号）。紙の種類ごとに名前付きのページ（pdoc-○○）を使う */
export function docPageCss(docs: { page: string; title: string }[], asOf: string) {
  const font = `font-family: var(--font, sans-serif); font-size: 8.5pt; color: #434a74;`;
  return `@media print {\n${docs
    .map(
      (d) =>
        `@page ${d.page} { size: A4 portrait; margin: 15mm 12mm 14mm; ` +
        `@top-left { content: ${cssString(`エンカレ夢中万博　${d.title}`)}; ${font} } ` +
        `@top-right { content: ${cssString(asOf)}; ${font} } ` +
        `@bottom-center { content: counter(page) " / " counter(pages); ${font} } }\n` +
        `@page ${d.page}:first { @top-left { content: none; } @top-right { content: none; } }\n` +
        `.pst-item--${d.page} { page: ${d.page}; }`,
    )
    .join("\n")}\n}`;
}

function DocHead({ kicker, title, meta }: { kicker: string; title: string; meta: string }) {
  return (
    <header className="pst-doc-head">
      <p className="pst-doc-kicker">{kicker}</p>
      <h3 className="pst-doc-title">{title}</h3>
      <p className="pst-doc-meta">{meta}</p>
    </header>
  );
}

/** お店・出し物の一覧（部門ごと） */
export function ShopListDoc({ groups, where, asOf }: { groups: { d: Dept; list: Shop[] }[]; where: Where; asOf: string }) {
  return (
    <article className="pst-doc" aria-label="お店・出し物の一覧（受付・本部の控え）">
      <DocHead
        kicker={`受付・本部の控え ・ ${asOf}`}
        title="エンカレ夢中万博　お店・出し物の一覧"
        meta={`${DOT_DATE} ${EVENT.hours} ・ ${VENUE.name} ・ 値段は予定です`}
      />
      {groups.length === 0 && <p>出しているお店・出し物は、まだありません。</p>}
      {groups.map(({ d, list }) => (
        <section key={d.id} className="pst-doc-sec" style={{ "--c": TONE_HEX[d.color] } as CSSProperties}>
          <h4 className="pst-doc-h">
            {d.name}
            <small>{list.length} 件</small>
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
                  <td className="pst-doc-place">{placeCell(where(s))}</td>
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
  );
}

function TimeTable({ rows, placeOf }: { rows: TimedRow[]; placeOf: (shopId: string) => string }) {
  return (
    <table className="pst-doc-table pst-doc-table--time">
      <thead>
        <tr>
          <th scope="col">時刻</th>
          <th scope="col">すること</th>
          <th scope="col">お店・出し物</th>
          <th scope="col">場所</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} style={{ "--c": TONE_HEX[r.color as Tone] ?? TONE_HEX.brown } as CSSProperties}>
            <td className="pst-doc-time">{r.time || "—"}</td>
            <td>{r.text}</td>
            <td>
              {r.deptShort} ・ {r.shopName}
            </td>
            <td className="pst-doc-place">{placeOf(r.shopId)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** タイムテーブル（全部のお店の当日の流れ。場所の列つき） */
export function TimetableDoc({ timed, other, placeOf, asOf }: { timed: TimedRow[]; other: TimedRow[]; placeOf: (shopId: string) => string; asOf: string }) {
  return (
    <article className="pst-doc" aria-label="タイムテーブル（受付・本部の控え）">
      <DocHead
        kicker={`受付・本部の控え ・ ${asOf}`}
        title="エンカレ夢中万博　タイムテーブル"
        meta={`${DOT_DATE} ${EVENT.hours} ・ ${VENUE.name} ・ 時刻は変わることがあります`}
      />
      {timed.length === 0 && other.length === 0 && <p>予定は、まだありません。決まりしだいお知らせします。</p>}
      {timed.length > 0 && <TimeTable rows={timed} placeOf={placeOf} />}
      {other.length > 0 && (
        <>
          <h4 className="pst-doc-h">時刻が決まっていないもの・一日じゅう開いているもの</h4>
          <TimeTable rows={other} placeOf={placeOf} />
        </>
      )}
    </article>
  );
}

const KIND_LABEL = Object.fromEntries(PLACE_KINDS.map((k) => [k.value, k.label])) as Record<PlaceKind, string>;
/** 索引に出す設備の順 */
const FAC_ORDER: PlaceKind[] = ["info", "aid", "toilet", "rest", "gate"];

/** 設備の場所を短く：同じ建物の階は「知育館 2階・3階・4階」にまとめる。外は場所の名前 */
function facilityText(list: Place[], areas: Area[]) {
  const byId = new Map(areas.map((a) => [a.id, a]));
  const floors = new Map<string, string[]>();
  const outside: string[] = [];
  for (const a of areas) {
    for (const p of list) if (p.area === a.id) floors.set(a.building, [...(floors.get(a.building) ?? []), a.floor]);
  }
  for (const p of list) if (!p.area || !byId.has(p.area)) outside.push(p.name);
  return [...[...floors].map(([b, fs]) => `${b} ${[...new Set(fs)].join("・")}`), ...outside].join(" ／ ");
}

/**
 * 場所の索引（1 枚）：場所の順（外 → 各階）に「お店・出し物 → 部屋」。受付で「○○はどこ？」と聞かれたとき・入口に貼る。
 * 五十音の順は、漢字の読みがデータに無いので作れない。設備（受付・救護・トイレなど）は、地図にピンがあるものだけ
 */
export function IndexDoc({ shops, places, areas, depts, where, asOf }: { shops: Shop[]; places: Place[]; areas: Area[]; depts: Dept[]; where: Where; asOf: string }) {
  const dept = deptLookup(depts);
  const rows = shops.map((s) => ({ s, w: where(s) }));
  const roomOrder = (a: PlaceInfo, b: PlaceInfo) => a.room.localeCompare(b.room, "ja", { numeric: true });
  const groups = [
    { key: "out", title: "外", list: rows.filter((r) => r.w.set && r.w.outside) },
    ...areas.map((a) => ({ key: a.id, title: areaName(a), list: rows.filter((r) => r.w.set && !r.w.outside && r.w.area === a.id) })),
    { key: "none", title: "場所が未定", list: rows.filter((r) => !r.w.set) },
  ]
    .map((g) => ({ ...g, list: [...g.list].sort((a, b) => roomOrder(a.w, b.w) || a.s.order - b.s.order) }))
    .filter((g) => g.list.length > 0);
  const facilities = FAC_ORDER.map((k) => ({ k, list: places.filter((p) => isFacility(p) && placeKindOf(p) === k) })).filter((f) => f.list.length > 0);
  return (
    <article className="pst-doc pst-doc--index" aria-label="お店・出し物の場所の索引">
      <DocHead kicker={`受付・本部の控え（入口に貼ってもよい） ・ ${asOf}`} title="エンカレ夢中万博　お店・出し物の場所" meta={`${DOT_DATE} ${EVENT.hours} ・ 場所の順（外 → 建物の中）`} />
      {groups.length === 0 && <p>出しているお店・出し物は、まだありません。</p>}
      <div className="pix-cols">
        {groups.map((g) => (
          <section key={g.key} className="pix-group">
            <h4 className="pix-h">{g.title}</h4>
            <ul className="pix-list">
              {g.list.map(({ s, w }) => (
                <li key={s.id}>
                  <span className="pix-name">
                    {s.name}
                    <small>{dept(s.dept).short}</small>
                  </span>
                  <span className="pix-where">
                    {w.set ? w.room : w.note || "未定"}
                    {w.set && w.note && <small>{w.note}</small>}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      {facilities.length > 0 && (
        <dl className="pix-fac">
          {facilities.map(({ k, list }) => (
            <div key={k}>
              <dt>{KIND_LABEL[k]}</dt>
              <dd>{facilityText(list, areas)}</dd>
            </div>
          ))}
        </dl>
      )}
    </article>
  );
}
