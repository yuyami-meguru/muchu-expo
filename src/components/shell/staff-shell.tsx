import type { ReactNode } from "react";
import type { NavGroup, NavItem } from "./nav-items";
import { SideShell, type ShellSearch, type ShellUser } from "./side-shell";

/**
 * 従業員側（お店の人・実行委員）の枠。AVERIX の事務のスタッフの枠（Figma 103:1007・103:1420）と同じ形。
 * groups は役割でしぼってから渡す（例：講師には「生徒・成績」だけ）。件数（count）も呼ぶ側で入れる。
 * ひな形は nav-items.ts の STAFF_GROUPS・STAFF_TABS。
 */
export function StaffShell({
  active,
  groups,
  tabs,
  user,
  search = null,
  notificationsHref,
  unread,
  homeHref = "/staff",
  logoutAction,
  children,
}: {
  active?: string;
  groups: NavGroup[];
  tabs: NavItem[];
  user?: ShellUser;
  /** null でさがす欄を出さない */
  search?: ShellSearch | null;
  notificationsHref?: string;
  unread?: boolean;
  homeHref?: string;
  logoutAction?: () => void | Promise<void>;
  children: ReactNode;
}) {
  return (
    <SideShell
      area="従業員"
      active={active}
      groups={groups}
      tabs={tabs}
      user={user}
      search={search ?? undefined}
      notificationsHref={notificationsHref}
      unread={unread}
      homeHref={homeHref}
      logoutAction={logoutAction}
    >
      {children}
    </SideShell>
  );
}
