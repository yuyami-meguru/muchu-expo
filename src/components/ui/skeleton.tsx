import type { ReactNode } from "react";
import { cx } from "./cx";
import { SlowHint } from "./slow-hint";

/* 読み込み中。形だけを先に見せる（ぐるぐるは使わない）。3 秒こえたら「少し時間がかかっています」と出す。 */

/** 形の 1 つ。width・height は px か "60%" などの文字 */
export function Skeleton({
  width,
  height,
  shape = "line",
  className,
}: {
  width?: number | string;
  height?: number | string;
  shape?: "line" | "circle" | "block";
  className?: string;
}) {
  const w = typeof width === "number" ? `${width}px` : width;
  const h = typeof height === "number" ? `${height}px` : height;
  return (
    <span
      className={cx("ui-skel", shape !== "line" && `ui-skel--${shape}`, className)}
      style={{ ...(w ? { ["--w" as string]: w } : {}), ...(h ? { ["--h" as string]: h } : {}) }}
      aria-hidden="true"
    />
  );
}

/** 一覧の形（頭文字＋2 行＋右の短い線）を rows 行 */
export function SkeletonRows({ rows = 5, avatar = true }: { rows?: number; avatar?: boolean }) {
  return (
    <div className="ui-stack" style={{ ["--gap" as string]: "10px" }} aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div className="ui-skel-row" key={i}>
          {avatar && <Skeleton shape="circle" width={36} />}
          <div className="ui-skel-lines">
            <Skeleton height={10} />
            <Skeleton height={8} width="35%" />
          </div>
          <Skeleton height={8} width={48} />
        </div>
      ))}
    </div>
  );
}

/** 数のカードの形を count 個 */
export function SkeletonStats({ count = 4 }: { count?: number }) {
  return (
    <div className="ui-stats" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div className="ui-stat" key={i}>
          <Skeleton height={8} width="40%" />
          <Skeleton shape="block" height={24} width={60} />
        </div>
      ))}
    </div>
  );
}

/**
 * 読み込み中の場所。中に形（Skeleton…）を入れる。
 * 読み上げには「読み込み中」とだけ伝え、3 秒こえたら案内を足す。
 */
export function Loading({ children, label = "読み込み中です", slowAfter = 3000 }: { children: ReactNode; label?: string; slowAfter?: number }) {
  return (
    <div aria-busy="true">
      <span className="sr-only" role="status">
        {label}
      </span>
      {children}
      <SlowHint after={slowAfter} />
    </div>
  );
}
