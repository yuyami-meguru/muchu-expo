import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/ui/logo";
import { SITE_URL } from "@/lib/site";
import { EVENT, VENUE } from "@/lib/venue";
import type { FooterColumn, NavItem } from "./nav-items";
import { BottomTabs } from "./bottom-tabs";
import { AppVersion } from "./app-version";
import { TextSizeButton } from "./text-size-button";
import { NavLink } from "./nav-link";
import { MadeBy } from "./made-by";

/**
 * お客さん側（だれでも見られるページ）の枠。AVERIX の PublicShell をもとに、当日スマホで使いやすい形にした。
 * active を渡さなければ、いまの URL からメニューの「いま」を決める（レイアウトに 1 つ置くため）。
 * パソコン（1024px 以上）：ロゴ・メニュー・文字を大きく。
 * それより狭いとき：上はロゴと「文字を大きく」だけ、メニューは画面の下に固定（アプリのように親指で押せる）。
 * いちばん下は紺の帯（主催・版）。印刷では、行事の名前・日時・場所・アドレスの 1 行だけになる（shell.css）。
 * top は上の帯のすぐ下に出すもの（全体の帯・電波が弱いときの帯）。本文に重ねず、本文を下へ押す。
 * 本文（main）の先頭に置くので、「本文へ」で飛んでも読み飛ばされない。
 */
export function PublicShell({
  active,
  items,
  footer,
  top,
  children,
}: {
  active?: string;
  items: NavItem[];
  footer: FooterColumn[];
  top?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="shell-pub mx-pub">
      <header className="shell-ptop">
        <div className="shell-ptop-inner">
          <Logo href="/" label="エンカレ夢中万博 ホームへ" />
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
        {top}
        {children}
      </main>

      <footer className="shell-pfoot">
        <div className="shell-pfoot-inner">
          <div className="shell-pfoot-brand">
            <Logo tone="dark" href="/" label="エンカレ夢中万博 ホームへ" />
            <p className="shell-pfoot-motto">つながる夢、広がる未来！</p>
            <p className="shell-pfoot-line">
              <span>
                <span className="keep">{EVENT.date}</span> <span className="keep">{EVENT.hours}</span>
              </span>
            </p>
            <p className="shell-pfoot-line">{VENUE.name}</p>
            <p className="shell-pfoot-line">
              <a href={EVENT.instagram} target="_blank" rel="noopener noreferrer">
                準備の様子は Instagram（別の画面で開きます）
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
          {/* 学校のロゴ（学校のサイトの画像を SVG に描き直したもの）。紺の帯用の版 school-logo-white.svg（マークの灰色・赤は元の色、黒だけ白） */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/school-logo-white.svg" alt="学校法人鶴学園 広島工業大学高等学校［通信制課程］（学校のサイトへ。別の画面で開きます）" width={480} height={60} loading="lazy" decoding="async" />
        </a>
        <MadeBy tone="dark" />
        <p className="shell-pfoot-copy">
          主催：{EVENT.organizer} ・ エンカレ夢中万博 実行委員会 ・ サイト制作：AVERIX ・ <AppVersion />
        </p>
        {/* 印刷のときだけ出す 1 行（紙を見た人が、もう一度このサイトを開けるように） */}
        <p className="shell-pfoot-print">
          {"エンカレ夢中万博\u3000"}
          <span className="nowrap">{EVENT.date}</span> <span className="nowrap">{EVENT.hours}</span>
          {`\u3000${VENUE.name}\u3000`}
          <span className="nowrap">{SITE_URL.replace(/^https?:\/\//, "")}</span>
        </p>
      </footer>

      <BottomTabs items={items} active={active} label="サイトのメニュー" />
    </div>
  );
}
