import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ADMIN_GROUPS, ADMIN_TABS, StaffShell, shopTabs } from "@/components/shell";
import { getSession } from "@/lib/auth";
import { getShop } from "@/lib/store";
import { LogoutButton } from "./_components/logout-button";
import "../staff.css";

export const metadata: Metadata = { title: { default: "お店・実行委員", template: "%s | 夢中万博 従業員" }, robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * 従業員側の枠（AVERIX の StaffShell）。ログインしていなければ入口へ。
 * 実行委員：すべてのメニュー／お店の人：自分のお店の売り切れと、お客さんの画面だけ。
 * ログアウトはページのいちばん下（StaffShell の logoutAction は AVERIX の「ログインの方法」も出すので使わない）。
 */
export default async function StaffInLayout({ children }: { children: React.ReactNode }) {
  const s = await getSession();
  if (!s) redirect("/staff/login");
  const shop = s.role === "shop" ? await getShop(s.shop) : null;
  const tabs = s.role === "admin" ? ADMIN_TABS : shopTabs(s.shop);
  return (
    <StaffShell
      active={undefined}
      groups={s.role === "admin" ? ADMIN_GROUPS : [{ label: "お店", items: tabs }]}
      tabs={tabs}
      user={s.role === "admin" ? { name: "実行委員", sub: "合言葉でログイン中" } : { name: shop?.name ?? "お店", sub: "お店の QR でログイン中" }}
      search={null}
      homeHref="/staff"
    >
      {children}
      <div className="st-foot">
        <LogoutButton />
      </div>
    </StaffShell>
  );
}
