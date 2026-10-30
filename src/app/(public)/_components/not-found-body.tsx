import Link from "next/link";
import { Sprite } from "@/components/pixel/sprites";

/**
 * 「ページが見つかりません」の中身（お客さん側の枠の中と、枠のないページの両方で使う。枠のないページでも崩れないよう、形はここに直接書く）。
 * 行き先は、ホーム・お店・出し物・マップ・ご来場の方へ（下のメニューと同じ）
 */
export function NotFoundBody() {
  return (
    <div>
      <Sprite name="controller" size={96} />
      <h1 className="px-title" style={{ fontSize: "clamp(2rem, 9vw, 3rem)", margin: "16px 0 8px", wordBreak: "auto-phrase" }}>
        ページが見つかりません
      </h1>
      <p style={{ color: "var(--ink-2)" }}>
        アドレスがちがうか、ページがなくなったのかもしれません。
        <br />
        お店・出し物のページが見られなくなったときも、このページが出ます。
      </p>
      <p style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginTop: 20 }}>
        <Link href="/" className="ui-btn ui-btn--primary ui-btn--lg">
          ホームへ
        </Link>
        <Link href="/shops" className="ui-btn ui-btn--secondary ui-btn--lg">
          お店・出し物
        </Link>
      </p>
      <p style={{ display: "flex", gap: "4px 20px", justifyContent: "center", flexWrap: "wrap", marginTop: 4 }}>
        <Link href="/map" style={{ display: "inline-flex", alignItems: "center", minHeight: 44, fontWeight: 900 }}>
          マップ
        </Link>
        <Link href="/schedule" style={{ display: "inline-flex", alignItems: "center", minHeight: 44, fontWeight: 900 }}>
          タイムテーブル
        </Link>
        <Link href="/info" style={{ display: "inline-flex", alignItems: "center", minHeight: 44, fontWeight: 900 }}>
          ご来場の方へ（行き方・送迎バス）
        </Link>
      </p>
    </div>
  );
}
