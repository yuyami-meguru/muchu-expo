import Link from "next/link";
import { cx } from "./cx";

/* ロゴ。AVERIX の絵のロゴの代わりに、ポスターと同じ 3 色の文字（エンカレ＝青・夢中＝オレンジ・万博＝緑）。
   tone: auto＝画面の明るさに合わせる・dark＝こげ茶の帯の上（いちばん下の帯） */
export function Logo({
  tone = "auto",
  size = "md",
  href = "/",
  label = "エンカレ夢中万博",
  className,
}: {
  tone?: "auto" | "light" | "dark";
  size?: "md" | "sm";
  /** null でリンクにしない */
  href?: string | null;
  label?: string;
  className?: string;
}) {
  const cls = cx("ui-logo", "mx-logo", size === "sm" && "mx-logo--sm", tone === "dark" && "mx-logo--dark", className);
  const inner = (
    <span aria-hidden="true">
      <span className="mx-logo-1">エンカレ</span>
      <span className="mx-logo-2">夢中</span>
      <span className="mx-logo-3">万博</span>
    </span>
  );
  if (href === null) {
    return (
      <span className={cls} role="img" aria-label={label}>
        {inner}
      </span>
    );
  }
  return (
    <Link href={href} className={cls} aria-label={label}>
      {inner}
    </Link>
  );
}
