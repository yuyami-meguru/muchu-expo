import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/icons";
import { cx } from "./cx";
import { BannerClose } from "./banner-close";

export type BannerTone = "success" | "error" | "warning" | "info";

const TONE_ICON: Record<BannerTone, IconName> = {
  success: "完了",
  error: "注意",
  warning: "注意",
  info: "情報",
};

/**
 * 知らせの帯（58:90）。何が起きたか＋次にすること を書く。
 * エラーは role="alert"（すぐ読み上げる）、そのほかは role="status"。
 */
export function Banner({
  tone = "info",
  title,
  children,
  actions,
  dismissible,
  className,
}: {
  tone?: BannerTone;
  title: ReactNode;
  children?: ReactNode;
  /** 帯の中に置くボタン（「もう一度ためす」など） */
  actions?: ReactNode;
  /** 右に × を出して消せるようにする */
  dismissible?: boolean;
  className?: string;
}) {
  return (
    <div className={cx("ui-banner", `ui-banner--${tone}`, className)} role={tone === "error" ? "alert" : "status"}>
      <Icon name={TONE_ICON[tone]} size={20} />
      <div className="ui-banner-body">
        <p className="ui-banner-title">{title}</p>
        {children && <div className="ui-banner-text">{children}</div>}
        {actions && <div className="ui-banner-actions">{actions}</div>}
      </div>
      {dismissible && <BannerClose />}
    </div>
  );
}
