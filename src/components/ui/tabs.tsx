import Link from "next/link";
import type { ReactNode } from "react";
import { cx } from "./cx";
import { Count } from "./badge";

export type TabItem = { key: string; label: ReactNode; href: string; count?: number };

/**
 * タブ（59:57）。画面の中の切りかえ（成績・コメント・保護者・公開）。4 つまで。
 * 中身はリンク。いまのタブに aria-current="page" を付ける。
 */
export function Tabs({ items, active, label, className }: { items: TabItem[]; active: string; label: string; className?: string }) {
  return (
    <nav className={cx("ui-tabs", className)} aria-label={label}>
      {items.map((t) => (
        <Link key={t.key} href={t.href} className="ui-tab" aria-current={t.key === active ? "page" : undefined}>
          {t.label}
          {t.count ? <Count value={t.count} /> : null}
        </Link>
      ))}
    </nav>
  );
}

export type SegmentOption = { value: string; label: string; href?: string };

/**
 * 切りかえ（日・週 など）。
 * href があればリンク（いまのものに aria-current）、なければ本物の radio（name が要る）。
 */
export function Segmented({
  label,
  options,
  value,
  defaultValue,
  name,
  className,
}: {
  label: string;
  options: SegmentOption[];
  /** リンクのとき：いまの値 */
  value?: string;
  /** radio のとき：はじめに選んでおく値 */
  defaultValue?: string;
  name?: string;
  className?: string;
}) {
  if (options.every((o) => o.href)) {
    return (
      <nav className={cx("ui-seg", className)} aria-label={label}>
        {options.map((o) => (
          <span key={o.value} className="ui-seg-item">
            <Link href={o.href!} className="ui-seg-face" aria-current={o.value === value ? "page" : undefined}>
              {o.label}
            </Link>
          </span>
        ))}
      </nav>
    );
  }
  return (
    <fieldset className={cx("ui-seg", className)}>
      <legend className="sr-only">{label}</legend>
      {options.map((o) => (
        <label key={o.value} className="ui-seg-item">
          <input type="radio" className="ui-seg-input" name={name ?? label} value={o.value} defaultChecked={o.value === (defaultValue ?? value)} />
          <span className="ui-seg-face">{o.label}</span>
        </label>
      ))}
    </fieldset>
  );
}
