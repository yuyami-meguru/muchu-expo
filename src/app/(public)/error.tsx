"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Sprite } from "@/components/pixel/sprites";

/**
 * お客さん側のページで不具合が起きたとき（保存先が一時的に読めないなど）。上の帯・下のメニューはそのまま出る。
 * 「もう一度読み込む」は、このページだけを読み直す（retry）
 */
export default function PublicError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="mx-error">
      <div>
        <Sprite name="controller" size={88} />
        <h1 className="px-title">うまく表示できませんでした</h1>
        <p>少ししてから［もう一度読み込む］を押してください。</p>
        <p className="mx-error-btns">
          <button type="button" className="ui-btn ui-btn--primary ui-btn--lg" onClick={() => retry()}>
            もう一度読み込む
          </button>
          <Link href="/" className="ui-btn ui-btn--secondary ui-btn--lg">
            ホームへ
          </Link>
        </p>
      </div>
    </div>
  );
}
