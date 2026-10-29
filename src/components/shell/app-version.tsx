import { APP_COMMIT, versionLabel } from "@/lib/version";
import { cx } from "@/components/ui/cx";

/** バージョンの小さな表記（いちばん下の帯・メニューの下）。コミットは問い合わせのときの目印に title に入れる */
export function AppVersion({ className }: { className?: string }) {
  return (
    <span className={cx("shell-version", className)} title={APP_COMMIT ? `コミット ${APP_COMMIT}` : undefined}>
      {versionLabel()}
    </span>
  );
}
