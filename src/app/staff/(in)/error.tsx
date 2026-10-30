"use client";

import { useEffect } from "react";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";

/**
 * 従業員側の画面が読み込めなかったとき（保存先が一瞬読めない・電波が切れた など）。
 * 英語の既定の画面の代わりに、日本語で「何が起きて、どうすればいいか」を出す。メニュー（枠）はそのまま使える。
 */
export default function StaffError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="st-page st-stack">
      <Banner tone="error" title="この画面を読み込めませんでした">
        電波が弱いか、保存先が少しのあいだ読めなかったようです。少し待ってから［もう一度読み込む］を押してください。何度やってもだめなときは、電波のよい所で、ブラウザでこのページを開き直してください。
      </Banner>
      <div className="st-row">
        <Button variant="primary" icon="元に戻す" onClick={() => retry()}>
          もう一度読み込む
        </Button>
        <Button href="/staff" variant="secondary" icon="ホーム">
          いちばん上の画面へ
        </Button>
      </div>
      {error.digest && <p className="st-muted">お問い合わせ用の番号：{error.digest}</p>}
    </div>
  );
}
