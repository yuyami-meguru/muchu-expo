"use client";

import { cx } from "@/components/ui/cx";
import { DEFAULT_LAYOUT, OUT_ROADS, OUT_TREES, OUT_VIEW, type OutItem, type OutLayout } from "@/lib/outside-plan";

/*
 * 外の地図の絵（会場マップ。はじめはパンフレット 2 ページ目と同じ配置・色分け・ドット絵）。枠は配置（OutLayout。実行委員が動かせる）から、
 * 道・木は決まった背景として SVG で描く。名前は画面の大きさで読める字にしたいので、SVG の中には書かず OutsideLabels（HTML）で重ねる
 * （フロアの見取り図と同じ作り）
 */

/* ───── ドット絵（パンフの会場マップと同じ。1 文字 = 1 マス、「.」は透明） ───── */
const PAL: Record<string, string> = {
  G: "#2f8f57",
  g: "#5fbe85",
  u: "#9fd77f",
  n: "#7a4a1e",
  b: "#3b5cc4",
  R: "#e04a5a",
  W: "#ffffff",
  m: "#8a93ab",
  l: "#c9d3e6",
  w: "#ffffff",
  d: "#3b3f4f",
};
const TREE = [
  "....GGGG....",
  "..GGggggGG..",
  ".GgggugggGG.",
  "GgguggggggGG",
  "GggggggguggG",
  "GgugggggggGG",
  ".GgggggugGG.",
  "..GGggggGG..",
  "....GnnG....",
  ".....nn.....",
  ".....nn.....",
  "....nnnn....",
];
const MAN = ["..bbb..", "..bbb..", "..bbb..", ".......", ".bbbbb.", "bbbbbbb", "b.bbb.b", "b.bbb.b", "..bbb..", "..b.b..", "..b.b..", "..b.b.."];
const WOMAN = ["..RRR..", "..RRR..", "..RRR..", ".......", "..RRR..", ".RRRRR.", "R.RRR.R", "RRRRRRR", "RRRRRRR", "..R.R..", "..R.R..", "..R.R.."];
const BUSSTOP = [
  "..RRRRR..",
  ".RRWWWRR.",
  "RRWRRRWRR",
  "RRWRRRWRR",
  "RRWWWWWRR",
  ".RRRRRRR.",
  "..RRRRR..",
  "....m....",
  "....m....",
  "...lll...",
  "...lwl...",
  "...lwl...",
  "...lll...",
  "....m....",
  "....m....",
  "....m....",
  "..ddddd..",
  ".ddddddd.",
];

type Drawn = { w: number; paths: { fill: string; d: string }[] };
const drawn = new Map<readonly string[], Drawn>();
/** 横に続く同じ色のマスを 1 つの四角にし、色ごとに 1 本の path にまとめる（絵ごとに 1 回だけ） */
function draw(rows: readonly string[]): Drawn {
  const hit = drawn.get(rows);
  if (hit) return hit;
  const byColor = new Map<string, string>();
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const c = row[x];
      let run = 1;
      while (x + run < row.length && row[x + run] === c) run++;
      const fill = PAL[c];
      if (c !== "." && fill) byColor.set(fill, `${byColor.get(fill) ?? ""}M${x} ${y}h${run}v1h-${run}z`);
      x += run;
    }
  });
  const d: Drawn = { w: Math.max(...rows.map((r) => r.length)), paths: [...byColor].map(([fill, p]) => ({ fill, d: p })) };
  drawn.set(rows, d);
  return d;
}
/** SVG の中のドット絵（左上 x・y、幅 w は地図の単位） */
function Pix({ rows, x, y, w }: { rows: readonly string[]; x: number; y: number; w: number }) {
  const p = draw(rows);
  return (
    <g transform={`translate(${x} ${y}) scale(${(w / p.w).toFixed(4)})`} shapeRendering="crispEdges">
      {p.paths.map((s) => (
        <path key={s.fill} fill={s.fill} d={s.d} />
      ))}
    </g>
  );
}

/** 枠 1 つの絵（四角・丸・トイレの印・バス停の標識。字だけの枠は絵が無い） */
function ItemShape({ it }: { it: OutItem }) {
  const w = it.x2 - it.x1;
  const h = it.y2 - it.y1;
  switch (it.shape ?? "rect") {
    case "round":
      return <ellipse className={`op-box op-${it.k}`} cx={it.x1 + w / 2} cy={it.y1 + h / 2} rx={w / 2} ry={h / 2} />;
    case "wc":
      return (
        <g transform={`translate(${it.x1} ${it.y1}) scale(${(w / 40).toFixed(4)} ${(h / 30).toFixed(4)})`}>
          <rect className="op-wc" x="0" y="0" width="40" height="30" rx="4" />
          <Pix rows={MAN} x={6} y={4} w={12} />
          <Pix rows={WOMAN} x={22} y={4} w={12} />
        </g>
      );
    case "busstop":
      return <Pix rows={BUSSTOP} x={it.x1} y={it.y1} w={w} />;
    case "text":
      return null;
    default:
      return <rect className={`op-box op-${it.k}`} x={it.x1} y={it.y1} width={w} height={h} rx={it.rx ?? 5} strokeDasharray={it.dash ? "7 5" : undefined} />;
  }
}

export function OutsidePlanSvg({ label, layout = DEFAULT_LAYOUT }: { label: string; layout?: OutLayout }) {
  const v = OUT_VIEW;
  return (
    <svg className="mx-map-svg op" viewBox={`${v.x} ${v.y} ${v.w} ${v.h}`} role="img" aria-label={label} preserveAspectRatio="xMidYMid meet">
      <rect className="op-ground" x={v.x} y={v.y} width={v.w} height={v.h} />
      {OUT_ROADS.map((r, i) => (
        <path key={`r${i}`} className="op-road" d={r.d} style={{ strokeWidth: r.w ?? 4 }} />
      ))}
      <path className="op-trees" d={OUT_TREES.area} />
      {OUT_TREES.at.map(([x, y]) => (
        <Pix key={`t${x}`} rows={TREE} x={x} y={y} w={OUT_TREES.size} />
      ))}
      {layout.items.map((it) => (
        <ItemShape key={it.id} it={it} />
      ))}
    </svg>
  );
}

const pctX = (v: number) => `${(((v - OUT_VIEW.x) / OUT_VIEW.w) * 100).toFixed(3)}%`;
const pctY = (v: number) => `${(((v - OUT_VIEW.y) / OUT_VIEW.h) * 100).toFixed(3)}%`;
/** 字の大きさ：パンフと同じ割合（地図の幅に合わせる）。せまい画面でも rem の下限より小さくしない（「文字を大きく」でも大きくなる） */
const fontOf = (size: number) => `max(0.7rem, ${((size / OUT_VIEW.w) * 100).toFixed(3)}cqi)`;

/**
 * 会場マップの名前（押せない字。ピンの名前はこれに重ならない所へ置く＝school-map.tsx の placeLabels）。
 * onBuilding を渡すと、建物（知育館）の枠をボタンにして、押すとその建物の中の地図へ（パンフの「中は次のページ ▶」の代わり）
 */
export function OutsideLabels({
  layout = DEFAULT_LAYOUT,
  onBuilding,
  tabbable = true,
}: {
  layout?: OutLayout;
  onBuilding?: (building: string) => void;
  tabbable?: boolean;
}) {
  return (
    <>
      {layout.items.map((b) => {
        const shape = b.shape ?? "rect";
        const w = b.x2 - b.x1;
        const h = b.y2 - b.y1;
        // トイレの印・バス停の標識の所（見えない）。ピンの名前の札がこの上に重ならないように（school-map.tsx の placeLabels がよける）
        if (shape === "wc" || shape === "busstop") {
          return (
            <span
              key={b.id}
              className="op-hit"
              style={{ left: pctX(b.x1), top: pctY(b.y1), width: `${((w / OUT_VIEW.w) * 100).toFixed(3)}%`, height: `${((h / OUT_VIEW.h) * 100).toFixed(3)}%` }}
              aria-hidden="true"
            />
          );
        }
        if (!b.label && !b.sub) return null;
        const cxv = (b.x1 + b.x2) / 2 + (b.dx ?? 0);
        const cyv = (b.y1 + b.y2) / 2 + (b.dy ?? 0);
        const size = b.size ?? 19;
        if (b.building && onBuilding) {
          const building = b.building;
          return (
            <button
              key={b.id}
              type="button"
              className="op-go"
              style={{ left: pctX(b.x1), top: pctY(b.y1), width: `${((w / OUT_VIEW.w) * 100).toFixed(3)}%`, height: `${((h / OUT_VIEW.h) * 100).toFixed(3)}%` }}
              aria-label={`${b.label.replace(/\n/g, "")}の中の地図を見る`}
              tabIndex={tabbable ? undefined : -1}
              aria-hidden={tabbable ? undefined : true}
              onClick={(e) => {
                e.stopPropagation();
                onBuilding(building);
              }}
            >
              <span className="op-label" style={{ left: `${(((cxv - b.x1) / w) * 100).toFixed(2)}%`, top: `${(((cyv - b.y1) / h) * 100).toFixed(2)}%`, fontSize: fontOf(size) }} aria-hidden="true">
                {b.label}
              </span>
              <span
                className="op-label op-label--go"
                style={{ left: `${(((cxv - b.x1) / w) * 100).toFixed(2)}%`, top: `${(((cyv + 31 - b.y1) / h) * 100).toFixed(2)}%`, fontSize: fontOf(12.5) }}
                aria-hidden="true"
              >
                中の地図 ▶
              </span>
            </button>
          );
        }
        return (
          <span
            key={b.id}
            className={cx("op-label", b.k === "recv" && "op-label--recv", shape === "text" && "op-label--note")}
            style={{ left: pctX(cxv), top: pctY(cyv), fontSize: fontOf(size) }}
            aria-hidden="true"
          >
            {b.label}
            {/* 名前の下に小さく添える字（大食堂の「体験・休憩」）。同じ札の 2 行目にして、地図の大きさが変わっても重ならないように */}
            {b.sub && <span className="op-label-sub">{`${b.label ? "\n" : ""}${b.sub}`}</span>}
          </span>
        );
      })}
    </>
  );
}
