import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/ui/logo";
import { EVENT, VENUE } from "@/lib/venue";
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
            <p className="shell-pfoot-line">
              {EVENT.date} {EVENT.hours}
            </p>
            <p className="shell-pfoot-line">{VENUE.name}</p>
            <p className="shell-pfoot-line">
              <a href={EVENT.instagram} target="_blank" rel="noopener noreferrer">
                準備の様子は Instagram（新しいタブ）
              </a>
            </p>
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
        <a className="mx-school" href={EVENT.web} target="_blank" rel="noopener noreferrer">
          {/* 学校のロゴ（学校のサイトの画像を SVG に描き直したもの）。紺の帯になじむよう白一色の版 school-logo-white.svg */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/school-logo-white.svg" alt="学校法人鶴学園 広島工業大学高等学校［通信制課程］（学校のサイトへ）" width={480} height={60} />
        </a>
        <p className="shell-pfoot-copy">
          主催：{EVENT.organizer} ・ エンカレ夢中万博 実行委員会 ・ <AppVersion />
        </p>
      </footer>

      <BottomTabs items={items} active={active} label="サイトのメニュー" />
    </div>
  );
}
