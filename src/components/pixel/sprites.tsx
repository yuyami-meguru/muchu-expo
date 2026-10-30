import type { CSSProperties } from "react";

/*
 * ドット絵の小物（学校のパンフレットの雰囲気。絵はここで 1 マスずつ描いたもの）。
 * 1 文字 = 1 マス。「.」は透明。色は PAL の文字で選ぶ。
 */
const PAL: Record<string, string> = {
  k: "#1f2547", // 線（紺）
  w: "#ffffff",
  l: "#c9d3e6", // 明るい灰
  m: "#8a93ab", // 灰
  d: "#3b3f4f", // こい灰
  g: "#5fbe85", // 緑
  G: "#2f8f57", // こい緑
  o: "#f39a2b", // オレンジ
  O: "#c76a12",
  r: "#e2453c",
  y: "#f7d03a",
  b: "#3b5cc4", // 青
  B: "#25398a",
  t: "#c99a52", // 木（ギター）
  T: "#8a5a22",
  p: "#8e7cf0", // 紫
  s: "#7fd0f5", // 水色
};

type Rows = readonly string[];

/** 描きかけの行の長さがそろっていなくても、短い行は右を透明でうめる */
function Pixels({ rows, size, label, style, className }: { rows: Rows; size: number; label?: string; style?: CSSProperties; className?: string }) {
  const w = Math.max(...rows.map((r) => r.length));
  const h = rows.length;
  const rects: React.ReactElement[] = [];
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const c = row[x];
      let run = 1;
      while (x + run < row.length && row[x + run] === c) run++;
      if (c !== "." && PAL[c]) rects.push(<rect key={`${x}-${y}`} x={x} y={y} width={run} height={1} fill={PAL[c]} />);
      x += run;
    }
  });
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width={size}
      height={(size * h) / w}
      shapeRendering="crispEdges"
      className={className}
      style={style}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    >
      {rects}
    </svg>
  );
}

const CONTROLLER: Rows = [
  "...kkkkkkkkkkkk...",
  "..kggggggggggggk..",
  ".kggkggggggggkggk.",
  "kggkkkggggggkgkggk",
  "kgggkggggggggkgggk",
  "kggggggkkkkgggggggk",
  "kgggggkkggkkggggggk",
  "kggggkk....kkgggggk",
  ".kggk........kgggk.",
  "..kk..........kkk..",
];

const CAMERA: Rows = [
  "...kkkk...........",
  "..kmmmmk..........",
  "kkkkkkkkkkkkkkkkkk",
  "kddddddkkkkkddlldk",
  "kdddddkllllkddlldk",
  "kddddklkkkklkdddddk",
  "kddddklkbbklkdddddk",
  "kddddklkbbklkdddddk",
  "kddddklkkkklkdddddk",
  "kdddddkllllkddddddk",
  "kddddddkkkkdddddddk",
  "kkkkkkkkkkkkkkkkkkk",
];

const GUITAR: Rows = [
  "..........kk",
  ".........ktk",
  "........ktk.",
  ".......ktk..",
  "......ktk...",
  "..kkkktk....",
  ".ktttwkk....",
  "kttkwktk....",
  "ktkkkttk....",
  "kttktttk....",
  ".ktttTk.....",
  "..kkkk......",
];

const SNEAKER: Rows = [
  ".....kkkkk.......",
  "....kdddddk......",
  "....kdwdwdk......",
  "...kddwdwddkk....",
  "...kdddddddddkk..",
  "..kddddddddddddk.",
  ".kwwwwwwwwwwwwwwk",
  ".kkkkkkkkkkkkkkkk",
];

const SKATE: Rows = [
  "..kkkkkkkkkkkkkkkkkk..",
  ".kbbbbbbbbbbbbbbbbbbk.",
  "kbbbbbBbbbbbbbbBbbbbbk",
  ".kbbbbbbbbbbbbbbbbbbk.",
  "..kkkkkkkkkkkkkkkkkk..",
  "....kmk........kmk....",
  "....kkk........kkk....",
];

const NOTE: Rows = [
  "....kkkk",
  "....kppk",
  "....kpk.",
  "....kpk.",
  "....kpk.",
  ".kkkkpk.",
  "kppppk..",
  "kpppk...",
  ".kkk....",
];

const PAINT: Rows = [
  "..kkkkkkk...",
  ".kwwwwwwwk..",
  "kwrwwbwwwwk.",
  "kwwwwwwywwwk",
  "kwgwwkkwwwwk",
  "kwwwk..kwwk.",
  ".kwwwkkwwk..",
  "..kkkkkkk...",
];

// 夢中アワード用（トロフィー・王冠）
const TROPHY: Rows = [
  "..kkkkkkkkkk..",
  "kkkyywyyyyykkk",
  "k.kyywyyyyyk.k",
  "k.kyywyyyyyk.k",
  ".kkyywyyyyykk.",
  "..kyyyyyyyyk..",
  "...kyyyyyyk...",
  "....kOyyOk....",
  ".....kyyk.....",
  ".....kyyk.....",
  "....kkyykk....",
  "...kOOOOOOk...",
  "...kkkkkkkk...",
];

const CROWN: Rows = [
  "k.....k.....k",
  "kk...kyk...kk",
  "kyk.kyyyk.kyk",
  "kyykyyyyykyyk",
  "kyyyyyyyyyyyk",
  "kyyrryybbyyyk",
  "kyyyyyyyyyyyk",
  "kkkkkkkkkkkkk",
];

/** ルービックキューブ（3×3 の面を上から見た形） */
function cubeRows(): Rows {
  const cols = ["r", "y", "w", "b", "g", "o", "y", "r", "b"];
  const rows: string[] = [];
  for (let y = 0; y < 13; y++) {
    let line = "";
    for (let x = 0; x < 13; x++) {
      if (x % 4 === 0 || y % 4 === 0) line += "k";
      else line += cols[Math.floor(y / 4) * 3 + Math.floor(x / 4)];
    }
    rows.push(line);
  }
  return rows;
}

/** バスケットボール（円と線を計算で描く） */
function ballRows(n = 16): Rows {
  const c = (n - 1) / 2;
  const rows: string[] = [];
  for (let y = 0; y < n; y++) {
    let line = "";
    for (let x = 0; x < n; x++) {
      const d = Math.hypot(x - c, y - c);
      if (d > c + 0.5) line += ".";
      else if (d > c - 0.6) line += "k";
      else if (Math.abs(x - c) < 0.6 || Math.abs(y - c) < 0.6) line += "k";
      else if (Math.abs(Math.hypot(x + c * 0.9, y - c) - c * 1.25) < 0.55) line += "k";
      else if (Math.abs(Math.hypot(x - n - c * 0.9 + 1, y - c) - c * 1.25) < 0.55) line += "k";
      else line += x + y > n ? "O" : "o";
    }
    rows.push(line);
  }
  return rows;
}

export const SPRITES = {
  controller: CONTROLLER,
  camera: CAMERA,
  guitar: GUITAR,
  sneaker: SNEAKER,
  skate: SKATE,
  note: NOTE,
  paint: PAINT,
  trophy: TROPHY,
  crown: CROWN,
  cube: cubeRows(),
  ball: ballRows(),
} as const;

export type SpriteName = keyof typeof SPRITES;

export function Sprite({ name, size = 64, label, style, className }: { name: SpriteName; size?: number; label?: string; style?: CSSProperties; className?: string }) {
  return <Pixels rows={SPRITES[name]} size={size} label={label} style={style} className={className} />;
}
