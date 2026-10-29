import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/ui/logo";
import { getSession } from "@/lib/auth";
import { LoginForm } from "./login-form";
import "../staff.css";
import { MadeBy } from "@/components/shell/made-by";

export const metadata: Metadata = { title: "お店・実行委員の入口", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function StaffLoginPage() {
  if (await getSession()) redirect("/staff");
  return (
    <main id="main" className="st-login">
      <div className="st-login-card">
        <Logo href="/" />
        <h1>実行委員・先生のログイン</h1>
        <p className="st-muted">合言葉を入れると、すべてのお店の売り切れ・地図・お知らせを変えられます。</p>
        <LoginForm />
        <p className="st-login-note">
          お店の人は、実行委員からもらった<strong>お店の QR</strong>を読み取ってください。自分のお店の売り切れを、ここから変えられるようになります。
        </p>
        <MadeBy tone="auto" />
      </div>
    </main>
  );
}
