import type { CSSProperties } from "react";
import { FloorLabels, FloorPlanSvg } from "@/components/map/floor-plan";
import { roomShapeOf } from "@/components/map/room-shape";
import { FLOOR_PLANS } from "@/lib/floor-plans";
import { areaName, areaOf, deptLookup, PLACE_KINDS, placeKindOf, type Area, type Dept, type Place, type PlaceKind, type Shop } from "@/lib/types";
import { EVENT } from "@/lib/venue";
import { isFacility, SHORT_DATE } from "./paper";

/*
 * フロアの案内の紙（階ごとに A4 縦 1 枚。各階の階段の前・建物の入口に貼る）。
 * 見取り図は地図の画面と同じ FloorPlanSvg を、白い地・黒い線で（floors.css）。部屋の名前とそこのお店・出し物、トイレなどの印を重ねる。
 * 載せるのは、地図のピン（部屋の四角・設備）とお店のデータにあるものだけ。データに無い設備（エレベーターなど）は描かない。人の名前は入れない。
 */

const KIND_LABEL = Object.fromEntries(PLACE_KINDS.map((k) => [k.value, k.label])) as Record<PlaceKind, string>;

export type FloorSheet = {
  area: Area;
  /** この階の部屋・場所（お店・出し物の場所のピン） */
  spots: Place[];
  /** この階の設備（トイレ・受付・救護・休憩所・入口） */
  facilities: Place[];
  /** 場所ごとのお店（非表示のお店は入れない） */
  shopsAt: Map<string, Shop[]>;
  /** この階のお店・出し物の数 */
  count: number;
  /** /map?area= の QR（SVG）と、そのアドレス（/map?area=f3） */
  qr: string;
  path: string;
};

/** 階ごとの紙の中身をそろえる（visible は非表示を除いたお店） */
export function floorSheets(areas: Area[], places: Place[], visible: Shop[]): Omit<FloorSheet, "qr" | "path">[] {
  return areas.map((area) => {
    const inArea = places.filter((p) => areaOf(p) === area.id);
    const spots = inArea.filter((p) => placeKindOf(p) === "spot");
    const shopsAt = new Map(spots.map((p) => [p.id, visible.filter((s) => s.placeId === p.id)]));
    const count = [...shopsAt.values()].reduce((n, l) => n + l.length, 0);
    return { area, spots, facilities: inArea.filter(isFacility), shopsAt, count };
  });
}

/** 部屋の名前の数字の順（201・202・応接室…） */
const byName = (a: Place, b: Place) => a.name.localeCompare(b.name, "ja", { numeric: true });

export function FloorGuideSheet({ sheet, depts, host, asOf }: { sheet: FloorSheet; depts: Dept[]; host: string; asOf: string }) {
  const { area, spots, facilities, shopsAt, count } = sheet;
  const dept = deptLookup(depts);
  const plan = area.plan ? FLOOR_PLANS[area.plan] : undefined;
  const name = areaName(area);
  const used = spots.filter((p) => (shopsAt.get(p.id)?.length ?? 0) > 0).sort(byName);
  // 一覧の字の大きさ：4 件までは大きく（場所の補足も）、8 件までは 1 段、16 件までは 2 段、それより多いと 3 段（1 枚に収める）
  const size = count <= 4 ? "big" : count <= 8 ? "1" : count <= 16 ? "2" : "3";
  const kinds = [...new Set(facilities.map((p) => placeKindOf(p)))];
  return (
    <section className="pfl-sheet" aria-label={`${name}のフロアの案内`}>
      <div className="pfl-in">
        <header className="pfl-head">
          <p className="pfl-kicker">フロアの案内</p>
          <h2 className="pfl-title">{name}</h2>
          <p className="pfl-event">
            エンカレ夢中万博　{SHORT_DATE} {EVENT.hours}
          </p>
        </header>

        {plan ? (
          <div className="pfl-plan">
            <FloorPlanSvg shapes={plan} label={`${name}の見取り図`} />
            <FloorLabels shapes={plan} />
            {spots.map((p) => {
              const here = shopsAt.get(p.id) ?? [];
              const box = !!(p.w && p.h);
              // ホール・廊下の四角は、地図の画面と同じく床の形に切る（トイレ・階段の上まで塗らない。名前も床の上に置く）
              const shape = box ? roomShapeOf(plan, { x: p.x, y: p.y, w: p.w!, h: p.h! }) : null;
              const lab = shape?.label;
              const style: CSSProperties = box
                ? { left: `${p.x - p.w! / 2}%`, top: `${p.y - p.h! / 2}%`, width: `${p.w}%`, height: `${p.h}%`, clipPath: shape?.clip }
                : { left: `${p.x}%`, top: `${p.y}%` };
              const cls = ["pfl-room", !box && "pfl-room--pin", here.length > 0 && "pfl-room--has", shape && "pfl-room--shaped"].filter(Boolean).join(" ");
              return (
                <div key={p.id} className={cls} style={style}>
                  {shape && (
                    <svg className="pfl-room-shape" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                      <polygon points={shape.svg} />
                    </svg>
                  )}
                  <div
                    className="pfl-room-in"
                    style={lab ? { top: `${lab.top}%`, height: `${lab.bottom - lab.top}%`, left: `${lab.left}%`, width: `${lab.right - lab.left}%` } : undefined}
                    data-fit={here.length > 0 ? `${name}の見取り図の「${p.name}」` : undefined}
                  >
                    <span className="pfl-room-name">{p.name}</span>
                    {here.length > 0 && (
                      <ul className="pfl-room-shops">
                        {here.map((s) => (
                          <li key={s.id}>{s.name}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              );
            })}
            {facilities.map((p) => (
              <span key={p.id} className="pfl-fac" style={{ left: `${p.x}%`, top: `${p.y}%` }}>
                {placeKindOf(p) === "toilet" ? "WC" : p.name}
              </span>
            ))}
          </div>
        ) : (
          <p className="pfl-noplan">この階の見取り図は、まだありません。下の一覧と、スマホの地図をご覧ください。</p>
        )}

        {plan && (
          <ul className="pfl-legend" aria-label="見取り図の印">
            <li>
              <span className="pfl-key pfl-key--room" aria-hidden="true" />
              お店・出し物のある部屋
            </li>
            {kinds.map((k) => (
              <li key={k}>
                <span className="pfl-key pfl-key--fac" aria-hidden="true">
                  {k === "toilet" ? "WC" : ""}
                </span>
                {KIND_LABEL[k]}
              </li>
            ))}
          </ul>
        )}

        <div className="pfl-list" data-size={size} data-fit={`${name}の案内の一覧`}>
          <h3 className="pfl-list-h">
            この階のお店・出し物{count > 0 && <small>（{count} 件）</small>}
          </h3>
          {used.length === 0 ? (
            <p className="pfl-none">この階には、お店・出し物はありません。</p>
          ) : (
            <dl className="pfl-rows">
              {used.map((p) => (
                <div key={p.id} className="pfl-row">
                  <dt>{p.name}</dt>
                  <dd>
                    {(shopsAt.get(p.id) ?? []).map((s) => (
                      <span key={s.id} className="pfl-shop">
                        {s.name}
                        <span className="pfl-dept">{dept(s.dept).short}</span>
                        {size === "big" && s.placeNote.trim() && <span className="pfl-note">{s.placeNote.trim()}</span>}
                      </span>
                    ))}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>

        <footer className="pfl-foot">
          <div className="pfl-qr" role="img" aria-label={`${name}の地図の QR コード`} dangerouslySetInnerHTML={{ __html: sheet.qr }} />
          <div className="pfl-foot-text">
            <p className="pfl-foot-lead">スマホで、この階の地図と、売り切れ・いまの様子が見られます</p>
            <p className="pfl-url">
              {host}
              {sheet.path}
            </p>
            <p className="pfl-asof">{asOf}の案内です。変わることがあります</p>
          </div>
        </footer>
      </div>
    </section>
  );
}
