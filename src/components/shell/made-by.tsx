import { cx } from "@/components/ui/cx";

export const AVERIX_URL = "https://www.averix.jp/";

/* eslint-disable @next/next/no-img-element */
function Pair({ white, className }: { white: boolean; className?: string }) {
  const sfx = white ? "-white" : "";
  return (
    <>
      <img className={cx("mx-madeby-mark", className)} src={`/brand/averix-mark${sfx}.svg`} alt="" width={33} height={26} />
      <img className={cx("mx-madeby-word", className)} src={`/brand/averix-word${sfx}.svg`} alt="" width={94} height={13} />
    </>
  );
}
/* eslint-enable @next/next/no-img-element */

/**
 * 「サイト制作：AVERIX」のクレジット（このサイトは AVERIX が作ったもの）。
 * tone="dark" は紺の帯の上（白いロゴ）、"auto" は画面の明るさに合わせて色つき／白を切りかえる。
 */
export function MadeBy({ tone = "dark", className }: { tone?: "dark" | "auto"; className?: string }) {
  return (
    <a className={cx("mx-madeby", `mx-madeby--${tone}`, className)} href={AVERIX_URL} target="_blank" rel="noopener noreferrer" aria-label="サイト制作 AVERIX（AVERIX のサイトへ）">
      <span className="mx-madeby-k" aria-hidden="true">
        サイト制作
      </span>
      {tone === "dark" ? (
        <Pair white />
      ) : (
        <>
          <Pair white={false} className="mx-on-light" />
          <Pair white className="mx-on-dark" />
        </>
      )}
    </a>
  );
}
