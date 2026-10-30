import Link from "next/link";
import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/icons";
import { cx } from "./cx";

/** 一覧のまとまり。中に ListRow を並べる（行と行のあいだに線が入る） */
export function RowList({ children, label, className }: { children: ReactNode; label?: string; className?: string }) {
  return (
    <ul className={cx("ui-rows", className)} aria-label={label}>
      {children}
    </ul>
  );
}

export type RowLeadTone = "blue" | "red" | "yellow" | "green" | "life";

/**
 * 一覧の行（59:105）。行全体が押せる（href があるとき）。
 * 左は頭文字（avatar）かアイコン、右は時刻など（meta）、未読は右に青い点。
 */
export function ListRow({
  title,
  sub,
  meta,
  href,
  avatar,
  icon,
  tone = "blue",
  unread,
  trailing,
  chevron,
  action,
  newTab,
  className,
}: {
  title: ReactNode;
  sub?: ReactNode;
  /** 右上の小さい文字（「15:41」「昨日」） */
  meta?: ReactNode;
  href?: string;
  /** 頭文字にする名前 */
  avatar?: string;
  /** 頭文字の代わりのアイコン（四角い枠） */
  icon?: IconName;
  tone?: RowLeadTone;
  unread?: boolean;
  /** 右端に置くもの（札・時刻など） */
  trailing?: ReactNode;
  /** 行の中のボタン。パソコンは右端、スマホは行の下に横いっぱいで出す（href とはいっしょに使わない） */
  action?: ReactNode;
  /** 右端に「>」を出す */
  chevron?: boolean;
  /** href を新しいタブで開く（お客さんの画面など。いまの画面は閉じない） */
  newTab?: boolean;
  className?: string;
}) {
  const lead = icon ? (
    <span className={cx("ui-row-lead", "ui-row-lead--square", tone !== "blue" && `ui-row-lead--${tone}`)} aria-hidden="true">
      <Icon name={icon} size={20} />
    </span>
  ) : avatar ? (
    <span className={cx("ui-row-lead", tone !== "blue" && `ui-row-lead--${tone}`)} aria-hidden="true">
      {Array.from(avatar.trim())[0]}
    </span>
  ) : null;

  const content = (
    <>
      {lead}
      <span className="ui-row-body">
        <span className="ui-row-top">
          <span className="ui-row-title">{title}</span>
          {meta && <span className="ui-row-meta">{meta}</span>}
        </span>
        {sub && <span className="ui-row-sub">{sub}</span>}
      </span>
      {unread && (
        <span className="ui-row-unread">
          <span className="sr-only">未読</span>
        </span>
      )}
      {(trailing || chevron) && (
        <span className="ui-row-trail">
          {trailing}
          {chevron && <Icon name="右へ" size={20} />}
        </span>
      )}
      {action && <span className="ui-row-action">{action}</span>}
    </>
  );

  const cls = cx("ui-row", unread && "ui-row--unread", action ? "ui-row--action" : undefined, className);
  if (href && newTab) {
    return (
      <li>
        <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
          {content}
          <span className="sr-only">（新しいタブで開きます）</span>
        </a>
      </li>
    );
  }
  return <li>{href ? <Link href={href} className={cls}>{content}</Link> : <div className={cls}>{content}</div>}</li>;
}
