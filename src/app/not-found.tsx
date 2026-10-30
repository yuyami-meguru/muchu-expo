import type { Metadata } from "next";
import { PUBLIC_FOOTER, PUBLIC_NAV, PublicShell } from "@/components/shell";
import { NotFoundBody } from "./(public)/_components/not-found-body";
// お客さん側の枠の見た目（「文字を大きく」のボタンなど）は (public) の CSS にあるので、ここでも読む
import "./(public)/public.css";

export const metadata: Metadata = { title: "ページが見つかりません" };

/**
 * ページが見つからないとき（アドレスのまちがい・古いリンク）。お客さん側のページの中で見つからないときは (public)/not-found.tsx。
 * 迷わないよう、お客さん側と同じ枠（上の帯・下のタブ・いちばん下の帯）に入れて、ホームやマップへすぐ移れるようにする
 */
export default function NotFound() {
  return (
    <PublicShell items={PUBLIC_NAV} footer={PUBLIC_FOOTER}>
      <div style={{ minHeight: "60vh", display: "grid", placeItems: "center", padding: "40px 16px", textAlign: "center" }}>
        <NotFoundBody />
      </div>
    </PublicShell>
  );
}
