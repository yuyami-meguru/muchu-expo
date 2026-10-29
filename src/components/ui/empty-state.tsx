import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/icons";
import { cx } from "./cx";

/**
 * 空の状態（60:65）。「まだ何もない」ときに、次にできることを 1 つ出す。
 * 例：まだ予約はありません → 申し込む
 */
export function EmptyState({
  icon = "一覧",
  title,
  children,
  action,
  className,
}: {
  icon?: IconName;
  title: ReactNode;
  children?: ReactNode;
  /** 次にすることのボタン（1 つか 2 つ） */
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("ui-empty", className)}>
      <span className="ui-empty-mark" aria-hidden="true">
        <Icon name={icon} size={28} />
      </span>
      <p className="ui-empty-title">{title}</p>
      {children && <p className="ui-empty-text">{children}</p>}
      {action && <div className="ui-empty-actions">{action}</div>}
    </div>
  );
}
