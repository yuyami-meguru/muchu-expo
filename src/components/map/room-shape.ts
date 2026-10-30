import { FLOOR_VIEW, type PlanShape } from "@/lib/floor-plans";

/*
 * 見取り図の上の「部屋の四角」の形を、床の形に合わせる道具（画面とサーバーの両方で使う）。
 * ホール・廊下などの四角は L 字の床をまるごと囲む四角なので、そのままだとトイレ・階段・建物の外まで入る。
 * 四角の真ん中が床（hall）の上にあれば、四角を床の形で切った多角形にする（部屋の四角はそのまま）。
 * 実行委員が四角を動かしても、そのときの四角で切るので形が合う。
 */

export type Pt = [number, number];
/** 四角（見取り図の単位）。x0・y0 が左上、x1・y1 が右下 */
export type Rect = { x0: number; y0: number; x1: number; y1: number };

const rectPts = (r: Rect): Pt[] => [
  [r.x0, r.y0],
  [r.x1, r.y0],
  [r.x1, r.y1],
  [r.x0, r.y1],
];

/** 見取り図の床（廊下・ホール）の形。pts があればその多角形、無ければ四角 */
export function hallPolygons(plan: PlanShape[]): Pt[][] {
  return plan
    .filter((s) => s.k === "hall")
    .map((s) => s.pts ?? rectPts({ x0: s.x, y0: s.y, x1: s.x + (s.w ?? 0), y1: s.y + (s.h ?? 0) }));
}

/** 点が多角形の中か（偶奇の決まり） */
export function insidePolygon([px, py]: Pt, poly: Pt[]) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

/** 多角形を、軸にそった四角で切る（Sutherland–Hodgman。切る側の四角は凸なので、L 字の床でも切れる） */
function clipToRect(poly: Pt[], r: Rect): Pt[] {
  const sides: [(p: Pt) => boolean, (a: Pt, b: Pt) => Pt][] = [
    [(p) => p[0] >= r.x0, (a, b) => [r.x0, a[1] + ((b[1] - a[1]) * (r.x0 - a[0])) / (b[0] - a[0])]],
    [(p) => p[0] <= r.x1, (a, b) => [r.x1, a[1] + ((b[1] - a[1]) * (r.x1 - a[0])) / (b[0] - a[0])]],
    [(p) => p[1] >= r.y0, (a, b) => [a[0] + ((b[0] - a[0]) * (r.y0 - a[1])) / (b[1] - a[1]), r.y0]],
    [(p) => p[1] <= r.y1, (a, b) => [a[0] + ((b[0] - a[0]) * (r.y1 - a[1])) / (b[1] - a[1]), r.y1]],
  ];
  let out = poly;
  for (const [ins, cut] of sides) {
    const src = out;
    out = [];
    for (let i = 0; i < src.length; i++) {
      const cur = src[i];
      const prev = src[(i + src.length - 1) % src.length];
      if (ins(cur)) {
        if (!ins(prev)) out.push(cut(prev, cur));
        out.push(cur);
      } else if (ins(prev)) out.push(cut(prev, cur));
    }
    if (!out.length) break;
  }
  return tidy(out);
}

/** 同じ点のくり返しと、まっすぐの線の途中の点を除く */
function tidy(poly: Pt[]): Pt[] {
  const same = (a: Pt, b: Pt) => Math.abs(a[0] - b[0]) < 0.01 && Math.abs(a[1] - b[1]) < 0.01;
  let pts = poly.filter((p, i) => !same(p, poly[(i + poly.length - 1) % poly.length]));
  let changed = true;
  while (changed && pts.length > 3) {
    changed = false;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[(i + pts.length - 1) % pts.length];
      const b = pts[i];
      const c = pts[(i + 1) % pts.length];
      const cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      if (Math.abs(cross) < 0.01) {
        pts = pts.filter((_, j) => j !== i);
        changed = true;
        break;
      }
    }
  }
  return pts;
}

/** 多角形の面積（向きによらず正） */
function areaOf(poly: Pt[]) {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % poly.length];
    s += x1 * y2 - x2 * y1;
  }
  return Math.abs(s) / 2;
}

/** 部屋の四角（x・y が真ん中、w・h とも見取り図の枠に対する割合 0〜100）を、見取り図の単位の四角に */
export function boxRect(p: { x: number; y: number; w: number; h: number }): Rect {
  const v = FLOOR_VIEW;
  const x0 = v.x + ((p.x - p.w / 2) / 100) * v.w;
  const y0 = v.y + ((p.y - p.h / 2) / 100) * v.h;
  return { x0, y0, x1: x0 + (p.w / 100) * v.w, y1: y0 + (p.h / 100) * v.h };
}

/**
 * 四角の真ん中が床（hall）の上にあれば、四角を床の形で切った多角形（見取り図の単位）。
 * 切らなくてよい（真ん中が部屋の中・切っても四角のまま）なら null
 */
export function clipToHall(plan: PlanShape[], r: Rect): Pt[] | null {
  const mid: Pt = [(r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2];
  const hall = hallPolygons(plan).find((h) => insidePolygon(mid, h));
  if (!hall) return null;
  // 四角の位置は 0.1% きざみなので、床の線とわずかにずれる。近い線（枠の 0.6% 以内）に合わせてから切る（細いすき間を作らない）
  const snap = (v: number, list: number[], tol: number) => {
    let best = v;
    let d = tol;
    for (const c of list) {
      const e = Math.abs(c - v);
      if (e <= d) {
        best = c;
        d = e;
      }
    }
    return best;
  };
  const xs = hall.map((p) => p[0]);
  const ys = hall.map((p) => p[1]);
  const tx = FLOOR_VIEW.w * 0.006;
  const ty = FLOOR_VIEW.h * 0.006;
  const s: Rect = { x0: snap(r.x0, xs, tx), y0: snap(r.y0, ys, ty), x1: snap(r.x1, xs, tx), y1: snap(r.y1, ys, ty) };
  const poly = clipToRect(hall, s);
  if (poly.length < 3) return null;
  const full = (s.x1 - s.x0) * (s.y1 - s.y0);
  return areaOf(poly) >= full * 0.995 ? null : poly;
}

/** 名前を置く所（四角の中の割合 0〜100）。上下は top〜bottom、左右は left〜right の真ん中に置く */
export type LabelBox = { top: number; bottom: number; left: number; right: number };

/** y の高さで横に切ったときの、多角形の中の区間（x の組） */
function spans(poly: Pt[], y: number): [number, number][] {
  const xs: number[] = [];
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % poly.length];
    if (y1 > y !== y2 > y) xs.push(x1 + ((x2 - x1) * (y - y1)) / (y2 - y1));
  }
  xs.sort((a, b) => a - b);
  const out: [number, number][] = [];
  for (let i = 0; i + 1 < xs.length; i += 2) out.push([xs[i], xs[i + 1]]);
  return out;
}

/**
 * 形を切った部屋で、名前を置く所。横幅いっぱいに床がある高さのうち、いちばん高い帯の真ん中
 * （ホールなら、トイレ・階段に欠けていない所）。そういう帯が無ければ、いちばん広い所
 */
function labelBoxOf(poly: Pt[]): LabelBox {
  const ys = [...new Set(poly.map((p) => p[1]))].sort((a, b) => a - b);
  let best: { top: number; bottom: number } | null = null;
  let run: { top: number; bottom: number } | null = null;
  let wide: (LabelBox & { score: number }) | null = null;
  for (let i = 0; i + 1 < ys.length; i++) {
    const top = ys[i];
    const bottom = ys[i + 1];
    const sp = spans(poly, (top + bottom) / 2);
    const len = sp.reduce((n, [a, b]) => n + (b - a), 0);
    if (len >= 95) {
      run = run ? { top: run.top, bottom } : { top, bottom };
      if (!best || run.bottom - run.top > best.bottom - best.top) best = { ...run };
    } else run = null;
    const [a, b] = sp.reduce((m, s) => (s[1] - s[0] > m[1] - m[0] ? s : m), [0, 0] as [number, number]);
    const score = (b - a) * (bottom - top);
    if (!wide || score > wide.score) wide = { top, bottom, left: a, right: b, score };
  }
  if (best) return { ...best, left: 0, right: 100 };
  return wide ? { top: wide.top, bottom: wide.bottom, left: wide.left, right: wide.right } : { top: 0, bottom: 100, left: 0, right: 100 };
}

export type RoomShape = {
  /** 四角の中の割合（0〜100）の多角形 */
  points: Pt[];
  /** CSS の clip-path（押せる所も形に合わせる） */
  clip: string;
  /** SVG の points（viewBox 0 0 100 100） */
  svg: string;
  label: LabelBox;
};

const r2 = (v: number) => Math.round(v * 100) / 100;

/** 部屋の四角を床の形で切ったもの（切らなくてよいなら null） */
export function roomShapeOf(plan: PlanShape[], box: { x: number; y: number; w: number; h: number }): RoomShape | null {
  const r = boxRect(box);
  const poly = clipToHall(plan, r);
  if (!poly) return null;
  // 四角（押せる所）の中の割合に。線に合わせた分だけ 0〜100 をわずかに出ることがあるので、中に収める
  const pct = (v: number, a: number, b: number) => r2(Math.min(100, Math.max(0, ((v - a) / (b - a)) * 100)));
  const points = tidy(poly.map(([x, y]): Pt => [pct(x, r.x0, r.x1), pct(y, r.y0, r.y1)]));
  return {
    points,
    clip: `polygon(${points.map(([x, y]) => `${x}% ${y}%`).join(", ")})`,
    svg: points.map((p) => p.join(",")).join(" "),
    label: labelBoxOf(points),
  };
}
