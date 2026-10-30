import { LiveProvider } from "@/components/live/live-provider";
import { SignalBanner } from "@/components/live/signal-banner";
import { SwRegister } from "@/components/live/sw-register";
import { PUBLIC_FOOTER, PUBLIC_NAV, PublicShell } from "@/components/shell";
import { liveOf } from "@/lib/live";
import { radioLive } from "@/lib/radio";
import { loadRadio } from "@/lib/radio-server";
import { loadAll } from "@/lib/store";
import "./public.css";

// お客さん側の共通の枠。はじめの「いまの様子」をサーバーで入れておき、そのあとは画面が 15 秒ごとに読み直す
// 電波の備え：サービスワーカー（本番だけ）で一度開いたページを保存し、電波が弱いときは上に帯を出す
export const dynamic = "force-dynamic";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const [data, radio] = await Promise.all([loadAll(), loadRadio()]);
  return (
    <LiveProvider initial={liveOf(data, radioLive(radio))}>
      <SwRegister />
      <SignalBanner />
      <PublicShell items={PUBLIC_NAV} footer={PUBLIC_FOOTER}>
        {children}
      </PublicShell>
    </LiveProvider>
  );
}
