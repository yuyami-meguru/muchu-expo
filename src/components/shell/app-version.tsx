import Link from "next/link";
import { APP_COMMIT, versionLabel } from "@/lib/version";
import { cx } from "@/components/ui/cx";

/**
 * バージョンの小さな表記（いちばん下の帯・メニューの下）。コミットは問い合わせのときの目印に title に入れる。
 * href を渡すと、そのページへのリンクになる（お客さん側のいちばん下の帯 → サイトのあゆみ /history。v0.28.0）
 */
export function AppVersion({ className, href }: { className?: string; href?: string }) {
  const title = APP_COMMIT ? `コミット ${APP_COMMIT}` : undefined;
  if (href) {
    return (
      <Link href={href} className={cx("shell-version", "shell-version--link", className)} title={title}>
        {versionLabel()}
        <span className="sr-only">（サイトのあゆみ）</span>
      </Link>
    );
  }
  return (
    <span className={cx("shell-version", className)} title={title}>
      {versionLabel()}
    </span>
  );
}
