import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MadeBy } from "@/components/shell/made-by";
import { Banner } from "@/components/ui/banner";
import { Logo } from "@/components/ui/logo";
import { getSession } from "@/lib/auth";
import { getShop } from "@/lib/store";
import { LoginForm } from "./login-form";
import "../staff.css";
import "./login.css";

export const metadata: Metadata = { title: "お店・実行委員の入口", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * お店・実行委員の入口。お店の人はお店の QR を読み取って、実行委員・先生は合言葉で入る。
 *  - ?from=expired：ログインが切れて来た人。いちばん上に「お店の人：ログインが切れました…」
 *  - ?from=logout：ログアウトしたあと
 * お店の人としてログイン中でも合言葉の欄を出す（入れると実行委員に切りかわる）。実行委員なら、そのまま /staff へ。
 */
export default async function StaffLoginPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const s = await getSession();
  if (s?.role === "admin") redirect("/staff");
  const shop = s?.role === "shop" ? await getShop(s.shop) : null;
  const { from } = await searchParams;
  return (
    <main id="main" className="st-login">
      <div className="st-login-card">
        {!s && from === "expired" && (
          <Banner tone="warning" title="お店の人：ログインが切れました">
            お店の QR をもう一度カメラで読み取ってください。
          </Banner>
        )}
        {!s && from === "logout" && (
          <Banner tone="success" title="ログアウトしました">
            お店の人は QR で、実行委員は合言葉で入れます。
          </Banner>
        )}
        <Logo href="/" />
        <h1>お店・実行委員の入口</h1>
        {s?.role === "shop" ? (
          <Banner tone="info" title={`いまは『${shop?.name ?? "お店"}』としてログイン中です`}>
            合言葉を入れると実行委員に切りかわります。<Link href="/staff">お店の画面にもどる</Link>
          </Banner>
        ) : (
          <section className="lg-sec" aria-labelledby="lg-shop-h">
            <h2 id="lg-shop-h">お店の人</h2>
            <p>
              実行委員からもらった<strong>お店の QR</strong>を、スマホのカメラで読み取ってください。合言葉はいりません。
            </p>
          </section>
        )}
        <section className="lg-sec lg-sec--admin" aria-labelledby="lg-admin-h">
          <h2 id="lg-admin-h">実行委員・先生</h2>
          <p className="st-muted">合言葉を入れると、すべてのお店の売り切れ・地図・お知らせを変えられます。</p>
          <LoginForm />
        </section>
        <MadeBy tone="auto" />
      </div>
    </main>
  );
}
