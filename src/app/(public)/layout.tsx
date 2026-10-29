import { LiveProvider } from "@/components/live/live-provider";
import { PUBLIC_FOOTER, PUBLIC_NAV, PublicShell } from "@/components/shell";
import { liveOf } from "@/lib/live";
import { loadAll } from "@/lib/store";
import "./public.css";

// お客さん側の共通の枠。はじめの「いまの様子」をサーバーで入れておき、そのあとは画面が 15 秒ごとに読み直す
export const dynamic = "force-dynamic";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const data = await loadAll();
  return (
    <LiveProvider initial={liveOf(data)}>
      <PublicShell items={PUBLIC_NAV} footer={PUBLIC_FOOTER}>
        {children}
      </PublicShell>
    </LiveProvider>
  );
}
