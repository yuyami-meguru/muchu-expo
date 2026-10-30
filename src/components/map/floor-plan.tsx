import { FLOOR_VIEW, type PlanShape } from "@/lib/floor-plans";

/*
 * フロアの見取り図（建物の形だけ）。部屋の名前やお店は、上に重ねる「部屋の四角」（school-map.tsx）が出す。
 * 字は画面の大きさで読める大きさにしたいので、SVG の中には書かず、FloorLabels（HTML）で重ねる。
 */

const pct = (v: number, axis: "x" | "y") => ((v - FLOOR_VIEW[axis]) / (axis === "x" ? FLOOR_VIEW.w : FLOOR_VIEW.h)) * 100;

function shapeEl(s: PlanShape, cls: string, key: string) {
  return s.pts ? (
    <polygon key={key} className={cls} points={s.pts.map((p) => p.join(",")).join(" ")} />
  ) : (
    <rect key={key} className={cls} x={s.x} y={s.y} width={s.w} height={s.h} />
  );
}

/** 描く順（下から）：廊下・ホールの床 → 部屋 → 使わない部屋・階段など → 壁 → 入口 */
const ORDER: Record<PlanShape["k"], number> = { hall: 0, zone: 1, room: 2, fixed: 3, stairs: 3, balc: 3, spiral: 3, wall: 5, door: 6, label: 7 };

export function FloorPlanSvg({ shapes, label }: { shapes: PlanShape[]; label: string }) {
  const v = FLOOR_VIEW;
  const list = [...shapes].sort((a, b) => ORDER[a.k] - ORDER[b.k]);
  return (
    <svg className="mx-map-svg fp" viewBox={`${v.x} ${v.y} ${v.w} ${v.h}`} role="img" aria-label={label} preserveAspectRatio="xMidYMid meet">
      <rect x={v.x} y={v.y} width={v.w} height={v.h} className="fp-bg" />
      {list.map((s, i) => {
        const key = `${s.k}${i}`;
        switch (s.k) {
          case "hall":
            return shapeEl(s, "fp-hall", key);
          case "room":
            return shapeEl(s, "fp-room", key);
          case "fixed":
            return shapeEl(s, "fp-fixed", key);
          case "stairs":
            return (
              <g key={key}>
                <rect className="fp-fixed" x={s.x} y={s.y} width={s.w} height={s.h} />
                {s.steps?.map((y) => <line key={y} className="fp-step" x1={s.x} y1={y} x2={s.x + (s.w ?? 0)} y2={y} />)}
                {s.mid !== undefined && <line className="fp-step" x1={s.mid} y1={s.y} x2={s.mid} y2={s.steps?.at(-1) ?? s.y} />}
              </g>
            );
          case "balc": {
            const w = s.w ?? 0;
            const h = s.h ?? 0;
            const r = Math.min(w * 0.95, h / 2);
            return (
              <path
                key={key}
                className="fp-fixed"
                d={`M${s.x + w} ${s.y}H${s.x + r}A${r} ${r} 0 0 0 ${s.x} ${s.y + r}V${s.y + h - r}A${r} ${r} 0 0 0 ${s.x + r} ${s.y + h}H${s.x + w}`}
              />
            );
          }
          case "spiral": {
            const cx = s.cx ?? 0;
            const cy = s.cy ?? 0;
            const r = s.r ?? 0;
            return (
              <g key={key}>
                <rect className="fp-room" x={s.x} y={s.y} width={cx - s.x} height={s.h} />
                <circle className="fp-fixed" cx={cx} cy={cy} r={r} />
                {Array.from({ length: 16 }, (_, j) => (
                  <line key={j} className="fp-step" x1={cx} y1={cy} x2={cx + r * Math.cos((j * Math.PI) / 8)} y2={cy + r * Math.sin((j * Math.PI) / 8)} />
                ))}
              </g>
            );
          }
          case "wall":
            return <line key={key} className="fp-wall" x1={s.x} y1={s.y} x2={s.x2} y2={s.y2} />;
          case "door":
            return <rect key={key} className="fp-door" x={s.x} y={s.y} width={s.w} height={s.h} />;
          default:
            return null;
        }
      })}
    </svg>
  );
}

/**
 * 使わない部屋（職員室など）・階段の名前。トイレは「WC」のピンが、P・S とバルコニーは来た人に要らないので出さない。
 * 字の位置は、もとの見取り図で決めた位置（lx・ly）があればそこ、無ければ真ん中。非常階段は丸い絵に重ならないよう絵の下に 2 行で。
 * 字が入らないほど小さい所（3 階・4 階の湯沸など）は出さない（線に重なって読めないので）
 */
export function FloorLabels({ shapes }: { shapes: PlanShape[] }) {
  const labels = shapes.flatMap((s) => {
    const name =
      s.k === "stairs" ? "階段" : s.k === "spiral" ? "非常\n階段" : (s.k === "fixed" || s.k === "label") && s.name ? s.name : "";
    if (!name || name.startsWith("トイレ") || name === "P・S" || name === "バルコニー") return [];
    const w = s.w ?? 0;
    const h = s.h ?? 0;
    if (s.k === "fixed" && (w < FLOOR_VIEW.w * 0.03 || h < FLOOR_VIEW.h * 0.035)) return [];
    const cx = s.k === "label" ? s.x : s.k === "spiral" ? (s.cx ?? s.x + w / 2) : s.lx !== undefined ? s.x + s.lx : s.x + w / 2;
    const cy = s.k === "label" ? s.y : s.k === "spiral" ? s.y + h + FLOOR_VIEW.h * 0.06 : s.ly !== undefined ? s.y + s.ly : s.y + h / 2;
    return [{ name, x: pct(cx, "x"), y: pct(cy, "y"), w: w ? (w / FLOOR_VIEW.w) * 100 : 8 }];
  });
  return (
    <>
      {labels.map((l, i) => (
        <span key={i} className="fp-label" style={{ left: `${l.x}%`, top: `${l.y}%`, maxWidth: `${Math.max(l.w, 6)}%` }} aria-hidden="true">
          {l.name}
        </span>
      ))}
    </>
  );
}
