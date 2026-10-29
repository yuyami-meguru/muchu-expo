"use client";

import { useId, useRef, type ReactNode } from "react";
import { Icon } from "@/components/icons";

/**
 * ボタンを押すと開く小さなメニュー（右上のアカウント・スマホのメニュー）。
 * ブラウザの popover を使うので、外を押すか Esc で閉じる。中のリンクを押したときも閉じる。
 */
export function PopoverMenu({
  trigger,
  triggerLabel,
  triggerClassName,
  className,
  header,
  children,
}: {
  /** ボタンの中身（頭文字の丸・メニューのアイコンなど） */
  trigger: ReactNode;
  /** ボタンの読み上げ */
  triggerLabel: string;
  triggerClassName?: string;
  className?: string;
  /** 開いたときの上の行（ロゴなど）。渡すと右に「閉じる」ボタンも付く */
  header?: ReactNode;
  children: ReactNode;
}) {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  return (
    <>
      <button type="button" className={triggerClassName} popoverTarget={id} aria-label={triggerLabel} title={triggerLabel}>
        {trigger}
      </button>
      <div
        ref={ref}
        id={id}
        popover="auto"
        className={className}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("a, button[type=submit]")) ref.current?.hidePopover();
        }}
      >
        {header && (
          <div className="shell-menu-top">
            {header}
            <button type="button" className="ui-icon-btn" popoverTarget={id} popoverTargetAction="hide" aria-label="閉じる" title="閉じる">
              <Icon name="閉じる" size={24} />
            </button>
          </div>
        )}
        {children}
      </div>
    </>
  );
}
