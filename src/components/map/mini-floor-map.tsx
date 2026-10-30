import Link from "next/link";
import { cx } from "@/components/ui/cx";
import { FLOOR_PLANS, FLOOR_VIEW, type PlanShape } from "@/lib/floor-plans";
import { areaName, areaOf, type Area, type Place } from "@/lib/types";
import { boxRect, clipToHall, type Pt } from "./room-shape";
import "./mini-floor-map.css";

/*
 * お店のページ用の小さな見取り図。その場所（部屋）だけに色を付ける。字は出さない（場所の名前はページの文で出す）。
 * サーバーで描く（JS を使わない）。色は部門の色（まわりの .tone-○○ の --c）、無ければアクセントの紫。ダークモードにも合わせる。
 * 外の場所・見取り図の無いフロア・場所が無いときは何も出さない（null）。
 */

const pct = (v: number, axis: "x" | "y") => (axis === "x" ? FLOOR_VIEW.x + (v / 100) * FLOOR_VIEW.w : FLOOR_VIEW.y + (v / 100) * FLOOR_VIEW.h);
const ptsOf = (pts: Pt[]) => pts.map((p) => p.map((n) => Math.round(n)).join(",")).join(" ");

/** 建物の形（床・部屋・使わない部屋・階段）だけを、線を細くして描く。壁・入口・段の線は省く（小さいと読めないので） */
function Shape({ s }: { s: PlanShape }) {
  const cls = s.k === "hall" ? "mm-hall" : s.k === "room" ? "mm-room" : "mm-fixed";
  if (s.k === "spiral") return <circle className="mm-fixed" cx={s.cx} cy={s.cy} r={s.r} />;
  if (s.pts) return <polygon className={cls} points={ptsOf(s.pts)} />;
  return <rect className={cls} x={s.x} y={s.y} width={s.w} height={s.h} />;
}

/** 見取り図の建物の外わく（少し余白を付けて、そこだけを描く） */
function boundsOf(plan: PlanShape[]) {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const s of plan) {
    if (s.k === "wall" || s.k === "label" || s.k === "door" || s.k === "zone") continue;
    if (s.pts) {
      xs.push(...s.pts.map((p) => p[0]));
      ys.push(...s.pts.map((p) => p[1]));
    } else if (s.w !== undefined && s.h !== undefined) {
      xs.push(s.x, s.x + s.w);
      ys.push(s.y, s.y + s.h);
    }
  }
  const pad = 60;
  const x = Math.min(...xs) - pad;
  const y = Math.min(...ys) - pad;
  return { x, y, w: Math.max(...xs) + pad - x, h: Math.max(...ys) + pad - y };
}

/**
 * 使い方（お店のページ。place はお店の場所のピン、areas は loadAll の areas）：
 *   <MiniFloorMap place={place} areas={areas} />
 *   押すとマップを開くなら href を渡す：<MiniFloorMap place={place} areas={areas} href={`/map?place=${place.id}`} />
 * 色はまわりの .tone-○○（部門の色）から取る。お店のページの <article className="sd tone-…"> の中なら、そのまま部門の色になる
 */
export function MiniFloorMap({ place, areas, href, className }: { place: Place | null | undefined; areas: Area[]; href?: string; className?: string }) {
  if (!place) return null;
  const area = areas.find((a) => a.id === areaOf(place));
  const plan = area?.plan ? FLOOR_PLANS[area.plan] : undefined;
  if (!area || !plan) return null;
  const v = boundsOf(plan);
  const where = `${areaName(area)}の見取り図。「${place.name}」に色を付けています`;
  // 部屋の四角なら、その四角（ホール・廊下は床の形に切った形）。ピン（トイレなど）なら丸い印
  let mark;
  if (place.w && place.h) {
    const r = boxRect({ x: place.x, y: place.y, w: place.w, h: place.h });
    const poly = clipToHall(plan, r);
    mark = poly ? (
      <polygon className="mm-here" points={ptsOf(poly)} />
    ) : (
      <rect className="mm-here" x={r.x0} y={r.y0} width={r.x1 - r.x0} height={r.y1 - r.y0} />
    );
  } else {
    mark = <circle className="mm-here mm-here--pin" cx={pct(place.x, "x")} cy={pct(place.y, "y")} r={110} />;
  }
  const svg = (
    <svg className="mm-svg" viewBox={`${Math.round(v.x)} ${Math.round(v.y)} ${Math.round(v.w)} ${Math.round(v.h)}`} role="img" aria-label={where}>
      {plan
        .filter((s) => s.k === "hall" || s.k === "room" || s.k === "fixed" || s.k === "stairs" || s.k === "balc" || s.k === "spiral")
        .map((s, i) => (
          <Shape key={i} s={s} />
        ))}
      {mark}
    </svg>
  );
  return (
    <figure className={cx("mx-mini", className)}>
      {href ? (
        <Link href={href} className="mx-mini-link" aria-label={`${where}（押すとマップで見られます）`}>
          {svg}
        </Link>
      ) : (
        svg
      )}
    </figure>
  );
}
