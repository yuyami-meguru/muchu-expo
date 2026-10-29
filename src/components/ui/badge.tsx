import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/icons";
import { cx } from "./cx";

/**
 * 札の色（共通のきまり 2）：
 * 赤＝すぐ対応がいる・黄＝待ち・緑＝済み・青＝種類・灰＝終わり
 */
export type BadgeColor = "red" | "yellow" | "green" | "blue" | "gray";

export function Badge({ color = "gray", icon, children, className }: { color?: BadgeColor; icon?: IconName; children: ReactNode; className?: string }) {
  return (
    <span className={cx("ui-badge", `ui-badge--${color}`, className)}>
      {icon && <Icon name={icon} size={14} />}
      {children}
    </span>
  );
}

/** 赤い丸の件数（左メニュー）。label は読み上げ用（例：「未返信 3 件」） */
export function Count({ value, label }: { value: number; label?: string }) {
  if (!value) return null;
  return (
    <span className="ui-count" aria-label={label ?? `${value} 件`}>
      {value > 99 ? "99+" : value}
    </span>
  );
}

/** 頭文字の丸 */
export function Avatar({ name, size = 36, className }: { name: string; size?: number; className?: string }) {
  const initial = Array.from(name.trim())[0] ?? "？";
  return (
    <span className={cx("ui-avatar", className)} style={{ ["--avatar" as string]: `${size}px` }} aria-hidden="true">
      {initial}
    </span>
  );
}
