import Link from "next/link";
import { Sprite } from "@/components/pixel/sprites";

/** ページが見つからないとき（お店が消えた・アドレスのまちがい） */
export default function NotFound() {
  return (
    <main id="main" style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: "32px 16px", textAlign: "center" }}>
      <div>
        <Sprite name="controller" size={96} />
        <h1 className="px-title" style={{ fontSize: "clamp(2rem, 9vw, 3rem)", margin: "16px 0 8px" }}>
          ページが見つかりません
        </h1>
        <p style={{ color: "var(--ink-2)" }}>
          アドレスがちがうか、ページがなくなったのかもしれません。
          <br />
          お店の名前が変わったときも、このページになることがあります。
        </p>
        <p style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginTop: 20 }}>
          <Link href="/" className="ui-btn ui-btn--primary ui-btn--lg">
            ホームへ
          </Link>
          <Link href="/shops" className="ui-btn ui-btn--secondary ui-btn--lg">
            お店・出し物
          </Link>
        </p>
      </div>
    </main>
  );
}
