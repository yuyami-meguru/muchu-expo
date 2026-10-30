"use client";

import { useEffect } from "react";

// この画面は、いちばん外の枠（app/layout.tsx）ごと動かなくなったときに出る。globals.css も字の形も読めないので、見た目はここだけで決める
const css = `
:root{color-scheme:light dark;--bg:#bfe4fb;--surface:#fff;--ink:#1f2547;--ink-2:#434a74;--title:#276b45;--primary:#1d6b41;--on-primary:#fff;--line:#4f7aa6}
@media (prefers-color-scheme:dark){:root{--bg:#0f1a33;--surface:#182747;--ink:#eef4ff;--ink-2:#bfcbe6;--title:#7fd6a2;--primary:#7fd6a2;--on-primary:#0f1a33;--line:#7b93c4}}
*{box-sizing:border-box}
body{margin:0;min-height:100dvh;display:grid;place-items:center;padding:32px 16px;background:var(--bg);color:var(--ink);
font-family:"Hiragino Maru Gothic ProN","Hiragino Sans","Yu Gothic",sans-serif;font-weight:500;line-height:1.75;text-align:center;overflow-wrap:anywhere}
h1{margin:0 0 8px;font-size:1.5rem;line-height:1.4;color:var(--title);word-break:auto-phrase}
p{margin:0 0 12px;color:var(--ink-2)}
.ge-btns{display:flex;flex-wrap:wrap;justify-content:center;gap:12px;margin-top:20px}
.ge-btn{display:inline-flex;align-items:center;justify-content:center;min-height:52px;padding:0 20px;border-radius:10px;font:inherit;font-size:1rem;font-weight:700;text-decoration:none;cursor:pointer}
.ge-btn--main{background:var(--primary);color:var(--on-primary);border:1px solid var(--primary)}
.ge-btn--sub{background:var(--surface);color:var(--ink);border:1px solid var(--line)}
:focus-visible{outline:3px solid var(--primary);outline-offset:2px}
`;

/**
 * いちばん外の枠で不具合が起きたとき（Next の英語の画面の代わり）。何が起きて、どうすればいいかを日本語で出す。
 * ［もう一度読み込む］はページ全体を読み直す（枠ごと作り直すため、retry より確か）
 */
export default function GlobalError({ error }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <html lang="ja">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <title>うまく表示できませんでした | エンカレ夢中万博</title>
        <style dangerouslySetInnerHTML={{ __html: css }} />
      </head>
      <body>
        <main>
          <h1>うまく表示できませんでした</h1>
          <p>
            電波が弱いか、サイトの調子が一時的に悪いのかもしれません。
            <br />
            少ししてから［もう一度読み込む］を押してください。
          </p>
          <p className="ge-btns">
            <button type="button" className="ge-btn ge-btn--main" onClick={() => window.location.reload()}>
              もう一度読み込む
            </button>
            {/* 枠が動かないので、ふつうのリンクでホームを開き直す */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/" className="ge-btn ge-btn--sub">
              ホームへ
            </a>
          </p>
        </main>
      </body>
    </html>
  );
}
