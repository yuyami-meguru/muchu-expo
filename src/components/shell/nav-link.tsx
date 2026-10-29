"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import type { NavItem } from "./nav-items";

/** いまの URL にいちばん長く合う項目の key（/staff と /staff/inbox なら /staff/inbox のほう） */
export function matchActive(path: string, items: Pick<NavItem, "key" | "href">[]) {
  let best: Pick<NavItem, "key" | "href"> | undefined;
  for (const i of items) {
    const href = i.href.split("?")[0];
    if (path === href || path.startsWith(`${href}/`)) {
      if (!best || href.length > best.href.split("?")[0].length) best = i;
    }
  }
  return best?.key;
}

/**
 * メニューの 1 項目。active を渡さなければ、いまの URL から自動で「いまの画面」を決める
 * （レイアウトからはいまの画面が分からないため）
 */
export function NavLink({
  item,
  siblings,
  overflow,
  active,
  className,
  children,
}: {
  item: NavItem;
  /** 同じメニューの項目すべて（いちばん合うものを選ぶのに使う） */
  siblings: Pick<NavItem, "key" | "href">[];
  /** 下のメニューに無い画面（パソコンの左のメニューの項目）。ここに合ったら最後の項目（その他・メニュー）を選ぶ */
  overflow?: Pick<NavItem, "key" | "href">[];
  active?: string;
  className?: string;
  children: ReactNode;
}) {
  const path = usePathname() ?? "";
  let key = active;
  if (key === undefined) {
    key = matchActive(path, [...siblings, ...(overflow ?? [])]);
    if (key !== undefined && !siblings.some((s) => s.key === key)) key = siblings.at(-1)?.key;
  }
  const current = key === item.key;
  return (
    <Link href={item.href} className={className} aria-current={current ? "page" : undefined}>
      {children}
    </Link>
  );
}
