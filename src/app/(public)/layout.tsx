import { LiveProvider } from "@/components/live/live-provider";
import { SignalBanner } from "@/components/live/signal-banner";
import { SwRegister } from "@/components/live/sw-register";
import { PUBLIC_FOOTER, PUBLIC_NAV, PublicShell } from "@/components/shell";
import { EMPTY_LIVE, liveOf, type Live } from "@/lib/live";
import { loadPublicOps } from "@/lib/ops-server";
import { radioLive } from "@/lib/radio";
import { loadRadio } from "@/lib/radio-server";
import { loadAll } from "@/lib/store";
import "./public.css";

// お客さん側の共通の枠。はじめの「いまの様子」をサーバーで入れておき、そのあとは画面が 15 秒ごとに読み直す
// 電波の備え：サービスワーカー（本番だけ）で一度開いたページを保存し、電波が弱いときは上に帯を出す
export const dynamic = "force-dynamic";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  // 保存先が一時的に読めなくても、枠（ご案内・地図など）は出す。いまの様子は読めしだい画面の側で入る
  let initial: Live = EMPTY_LIVE;
  try {
    const [data, radio, ops] = await Promise.all([loadAll(), loadRadio(), loadPublicOps()]);
    initial = liveOf(data, radioLive(radio), ops);
  } catch (e) {
    console.error("いまの様子を読めませんでした", e);
  }
  return (
    <LiveProvider initial={initial}>
      <SwRegister />
      <SignalBanner />
      <PublicShell items={PUBLIC_NAV} footer={PUBLIC_FOOTER}>
        {children}
      </PublicShell>
    </LiveProvider>
  );
}
