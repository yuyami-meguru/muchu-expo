import type { ReactNode } from "react";
import { cx } from "./cx";

/**
 * カード。title を渡すと見出しの行が付く（右に aside：「すべて見る」のリンクや「急ぐ順」など）。
 * flush は中に一覧（RowList）を入れるとき用で、余白をなくす。
 * headTone="muted" は見出しの行を灰色の帯にする（事務のホーム「今日やること」）。
 */
export function Card({
  title,
  aside,
  children,
  flush,
  raised,
  headTone,
  as: Tag = "section",
  headingLevel = 2,
  className,
  id,
}: {
  title?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  flush?: boolean;
  raised?: boolean;
  headTone?: "muted";
  as?: "section" | "div" | "article";
  headingLevel?: 2 | 3;
  className?: string;
  id?: string;
}) {
  const H = headingLevel === 3 ? "h3" : "h2";
  return (
    <Tag className={cx("ui-card", flush && "ui-card--flush", raised && "ui-card--raised", className)} id={id}>
      {title && (
        <div className={cx("ui-card-head", headTone === "muted" && "ui-card-head--muted")}>
          <H className="ui-card-title">{title}</H>
          {aside && <div className="ui-card-aside">{aside}</div>}
        </div>
      )}
      {children}
    </Tag>
  );
}

/** 背景なしの区切り（「やること（2）」「もう一度頼む」） */
export function Section({
  title,
  aside,
  children,
  headingLevel = 2,
  className,
  id,
}: {
  title: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  headingLevel?: 2 | 3;
  className?: string;
  id?: string;
}) {
  const H = headingLevel === 3 ? "h3" : "h2";
  return (
    <section className={cx("ui-section", className)} id={id}>
      <div className="ui-section-head">
        <H className="ui-section-title">{title}</H>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** 画面の題（h1）と、その右のいちばんのボタン */
export function PageHeader({ title, sub, actions, className }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <header className={cx("ui-page-head", className)}>
      <div>
        <h1 className="ui-page-title">{title}</h1>
        {sub && <p className="ui-page-sub">{sub}</p>}
      </div>
      {actions}
    </header>
  );
}

/** 縦に並べる（あいだ gap px） */
export function Stack({ children, gap = 12, className }: { children: ReactNode; gap?: number; className?: string }) {
  return (
    <div className={cx("ui-stack", className)} style={{ ["--gap" as string]: `${gap}px` }}>
      {children}
    </div>
  );
}
