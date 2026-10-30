import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_GROUPS, ADMIN_TABS, StaffShell, shopTabs } from "@/components/shell";
import { AppVersion } from "@/components/shell/app-version";
import { COOKIE, getSession } from "@/lib/auth";
import { getShop } from "@/lib/store";
import { LogoutButton } from "./_components/logout-button";
import "../staff.css";
import "./_components/shop.css";

export const metadata: Metadata = { title: { default: "お店・実行委員", template: "%s | 夢中万博 お店・実行委員" }, robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * 従業員側の枠（AVERIX の StaffShell）。ログインしていなければ入口へ。
 * ログインが切れて来た人（Cookie はあるのに使えない：QR が作り直された・期限が過ぎた）は /staff/login?from=expired へ。
 * 入口のいちばん上に「お店の人：ログインが切れました。お店の QR をもう一度…」と出す（はじめて来た人には出さない）。
 * 実行委員：すべてのメニュー／お店の人：自分のお店の売り切れと、お客さんの画面だけ。
 * ログアウトと版の番号はページのいちばん下（StaffShell の logoutAction は AVERIX の「ログインの方法」も出すので使わない）。
 */
export default async function StaffInLayout({ children }: { children: React.ReactNode }) {
  const s = await getSession();
  if (!s) redirect((await cookies()).has(COOKIE) ? "/staff/login?from=expired" : "/staff/login");
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
      <div className="st-foot sh-foot">
        <AppVersion className="sh-version" />
        <LogoutButton shop={s.role === "shop"} />
      </div>
    </StaffShell>
  );
}
