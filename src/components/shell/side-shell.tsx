import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/icons";
import { Avatar, Count } from "@/components/ui/badge";
import { IconButton } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { cx } from "@/components/ui/cx";
import { BottomTabs } from "./bottom-tabs";
import type { NavGroup, NavItem } from "./nav-items";
import { SearchShortcut } from "./search-shortcut";
import { NavLink } from "./nav-link";
import { AppVersion } from "./app-version";
import { MadeBy } from "./made-by";

export type ShellUser = {
  name: string;
  /** 名前の下の小さい文字（「管理者」「LINE でログイン中」） */
  sub?: string;
  /** 押したときの行き先（自分の設定など） */
  href?: string;
};

export type ShellSearch = {
  /** さがす画面の URL（GET で q= を付けて送る） */
  action: string;
  placeholder?: string;
};

/**
 * スタッフ側（事務・現場・講師）の共通の枠。
 * パソコン（1024px 以上）：左のメニュー 264px。スマホ・タブレット：上の帯＋下の固定メニュー。
 * データは取りに行かない。項目・件数・人の名前はすべて受け取る。
 */
export function SideShell({
  active,
  groups,
  tabs,
  user,
  search,
  notificationsHref,
  unread,
  homeHref,
  area,
  logoutAction,
  children,
}: {
  active?: string;
  /** 左のメニュー（見出しつきのまとまり） */
  groups: NavGroup[];
  /** スマホの下のメニュー（5 つまで） */
  tabs: NavItem[];
  user?: ShellUser;
  search?: ShellSearch;
  /** ベルの行き先。なければベルを出さない */
  notificationsHref?: string;
  /** ベルに赤い点を付ける */
  unread?: boolean;
  homeHref: string;
  /** 区画の名前（読み上げ用。「事務」「現場」「講師」） */
  area: string;
  /** ログアウトの処理（パソコンは左のメニューの下に出す。スマホは「その他」の画面で） */
  logoutAction?: () => void | Promise<void>;
  children: ReactNode;
}) {
  const searchId = "shell-search";
  return (
    <div className="shell-side">
      {/* パソコンの左のメニュー */}
      <aside className="shell-sidebar" aria-label={`${area}のメニュー`}>
        <div className="shell-sidebar-logo">
          <Logo href={homeHref} label={`エンカレ夢中万博 ${area}のホームへ`} />
        </div>
        {search && (
          <form action={search.action} method="get" role="search" className="shell-search">
            <Icon name="さがす" size={18} />
            <label htmlFor={searchId} className="sr-only">
              {search.placeholder ?? "さがす"}
            </label>
            <input id={searchId} name="q" type="search" placeholder={search.placeholder ?? "さがす"} autoComplete="off" />
            <kbd aria-hidden="true">⌘K</kbd>
            <SearchShortcut inputId={searchId} />
          </form>
        )}
        <nav className="shell-sidenav" aria-label={area}>
          {groups.map((g, gi) => (
            <div key={g.label ?? gi} className="shell-sidegroup">
              {g.label && <p className="shell-sidegroup-label">{g.label}</p>}
              <ul>
                {g.items.map((i) => (
                  <li key={i.key}>
                    {i.newTab ? (
                      // お客さんの画面などは新しいタブで（いまの画面はそのまま残す）
                      <a href={i.href} target="_blank" rel="noopener noreferrer" className="shell-sideitem">
                        <Icon name={i.icon} size={20} />
                        <span className="shell-sideitem-label">
                          {i.label}
                          <span className="sr-only">（新しいタブで開きます）</span>
                        </span>
                      </a>
                    ) : (
                      <NavLink item={i} siblings={groups.flatMap((x) => x.items)} active={active} className="shell-sideitem">
                        <Icon name={i.icon} size={20} />
                        <span className="shell-sideitem-label">{i.label}</span>
                        {!!i.count && <Count value={i.count} label={`${i.count} 件`} />}
                      </NavLink>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        {user && <UserBlock user={user} />}
        {logoutAction && (
          <form action={logoutAction} className="shell-logout">
            <button type="submit" className="shell-logout-btn">
              <Icon name="ログアウト" size={18} />
              ログアウト
            </button>
          </form>
        )}
        <AppVersion className="shell-version--side" />
        <MadeBy tone="auto" className="mx-madeby--side" />
      </aside>

      {/* スマホ・タブレットの上の帯 */}
      <header className="shell-phonebar">
        <Logo size="sm" href={homeHref} label={`エンカレ夢中万博 ${area}のホームへ`} />
        <span className="shell-grow" />
        {search && <IconButton icon="さがす" label="さがす" href={search.action} />}
        {notificationsHref && <IconButton icon="お知らせ" label={unread ? "お知らせ（新しいものがあります）" : "お知らせ"} href={notificationsHref} dot={unread} />}
      </header>

      <main id="main" className="shell-main shell-side-main">
        {children}
      </main>

      <BottomTabs items={tabs} overflow={groups.flatMap((g) => g.items)} active={active} label={`${area}のメニュー`} />
    </div>
  );
}

function UserBlock({ user }: { user: ShellUser }) {
  const inner = (
    <>
      <Avatar name={user.name} />
      <span className="shell-user-text">
        <span className="shell-user-name">{user.name}</span>
        {user.sub && <span className="shell-user-sub">{user.sub}</span>}
      </span>
    </>
  );
  return user.href ? (
    <Link href={user.href} className={cx("shell-user", "shell-user--link")}>
      {inner}
    </Link>
  ) : (
    <div className="shell-user">{inner}</div>
  );
}
