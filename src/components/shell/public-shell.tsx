import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/ui/logo";
import type { FooterColumn, NavItem } from "./nav-items";
import { BottomTabs } from "./bottom-tabs";
import { AppVersion } from "./app-version";
import { TextSizeButton } from "./text-size-button";
import { NavLink } from "./nav-link";

/**
 * お客さん側（だれでも見られるページ）の枠。AVERIX の PublicShell をもとに、当日スマホで使いやすい形にした。
 * active を渡さなければ、いまの URL からメニューの「いま」を決める（レイアウトに 1 つ置くため）。
 * パソコン（1024px 以上）：ロゴ・メニュー・文字を大きく。
 * それより狭いとき：上はロゴと「文字を大きく」だけ、メニューは画面の下に固定（アプリのように親指で押せる）。
 * いちばん下はこげ茶の帯（主催・版）。
 */
export function PublicShell({
  active,
  items,
  footer,
  children,
}: {
  active?: string;
  items: NavItem[];
  footer: FooterColumn[];
  children: ReactNode;
}) {
  return (
    <div className="shell-pub mx-pub">
      <header className="shell-ptop">
        <div className="shell-ptop-inner">
          <Logo href="/" label="エンカレ夢中万博 トップへ" />
          <nav className="shell-pnav" aria-label="サイトのメニュー">
            <ul>
              {items.map((i) => (
                <li key={i.key}>
                  <NavLink item={i} siblings={items} active={active} className="shell-pnav-item">
                    {i.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
          <span className="shell-grow" />
          <TextSizeButton />
        </div>
      </header>

      <main id="main" className="shell-pub-main">
        {children}
      </main>

      <footer className="shell-pfoot">
        <div className="shell-pfoot-inner">
          <div className="shell-pfoot-brand">
            <Logo tone="dark" href="/" label="エンカレ夢中万博 トップへ" />
            <p className="shell-pfoot-motto">つながる夢、広がる未来！</p>
            <p className="shell-pfoot-line">2026年11月28日（土）11:00〜14:00</p>
            <p className="shell-pfoot-line">広島工業大学高等学校 沼田校舎</p>
          </div>
          {footer.map((col) => (
            <nav key={col.title} className="shell-pfoot-col" aria-label={col.title}>
              <p className="shell-pfoot-title">{col.title}</p>
              <ul>
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href}>{l.label}</Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <p className="shell-pfoot-copy">
          主催：エンカレ夢中万博 実行委員会 ・ <AppVersion />
        </p>
      </footer>

      <BottomTabs items={items} active={active} label="サイトのメニュー" />
    </div>
  );
}
