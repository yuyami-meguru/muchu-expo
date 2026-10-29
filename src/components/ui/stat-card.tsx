import Link from "next/link";
import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/icons";
import { cx } from "./cx";

/** 数のカードを並べる。compact にするとスマホで 4 つを 1 行に（数と短い名前だけ） */
export function StatGrid({ children, compact, label, className }: { children: ReactNode; compact?: boolean; label?: string; className?: string }) {
  return (
    <div className={cx("ui-stats", compact && "ui-stats--compact", className)} role={label ? "group" : undefined} aria-label={label}>
      {children}
    </div>
  );
}

/**
 * 数のカード（60:56）。ホームの「LINE の未返信 3 件」など。
 * tone="red" で数を赤（すぐ対応がいる）、"yellow" で黄（待ち）。
 */
export function StatCard({
  label,
  shortLabel,
  value,
  unit,
  sub,
  icon,
  href,
  tone,
  className,
}: {
  label: string;
  /** スマホの compact で出す短い名前（「未返信」） */
  shortLabel?: string;
  value: ReactNode;
  unit?: string;
  sub?: ReactNode;
  icon?: IconName;
  href?: string;
  tone?: "red" | "yellow";
  className?: string;
}) {
  const content = (
    <>
      <span className="ui-stat-label">
        {icon && <Icon name={icon} size={20} />}
        <span className={shortLabel ? "ui-stat-long" : undefined}>{label}</span>
        {shortLabel && (
          <span className="ui-stat-short" aria-hidden="true">
            {shortLabel}
          </span>
        )}
      </span>
      <span className="ui-stat-num">
        <span className="ui-stat-value">{value}</span>
        {unit && <span className="ui-stat-unit">{unit}</span>}
      </span>
      {sub && <span className="ui-stat-sub">{sub}</span>}
    </>
  );
  const cls = cx("ui-stat", tone && `ui-stat--${tone}`, className);
  return href ? (
    <Link href={href} className={cls}>
      {content}
    </Link>
  ) : (
    <div className={cls}>{content}</div>
  );
}
