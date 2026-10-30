import Link from "next/link";
import { Sprite } from "@/components/pixel/sprites";

/** 「ページが見つかりません」の中身（お客さん側の枠の中と、枠のないページの両方で使う） */
export function NotFoundBody() {
  return (
    <div>
      <Sprite name="controller" size={96} />
      <h1 className="px-title" style={{ fontSize: "clamp(2rem, 9vw, 3rem)", margin: "16px 0 8px" }}>
        ページが見つかりません
      </h1>
      <p style={{ color: "var(--ink-2)" }}>
        アドレスがちがうか、ページがなくなったのかもしれません。
        <br />
        お店が非表示になったり、なくなったりしたときも、このページが出ます。
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
  );
}
