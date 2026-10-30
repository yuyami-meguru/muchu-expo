import type { Metadata, Viewport } from "next";
import { DotGothic16, Zen_Maru_Gothic } from "next/font/google";
import { TextSizeKeeper } from "@/components/shell/text-size-button";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

// 本文はまる文字（読みやすさ）、題字・見出しはドット文字（学校のパンフレットと同じ、ゲームの画面のような雰囲気）
// 日本語の字は、1 つの太さが 100 個ほどのファイルに分かれている。先読み（preload）すると、それを全部先に取りに行き、
// 遅い回線では最初の表示まで約 30 秒かかっていた（2026-10-31 の見直し）。先読みはやめて、画面に出る字の分だけを後から読む。
// 太さも 500・700 の 2 つにしぼる（900 と書いた所は 700 で出る。ブラウザが字を太らせることはない）
const maru = Zen_Maru_Gothic({ variable: "--font-maru", weight: ["500", "700"], subsets: ["latin"], display: "swap", preload: false });
const pixel = DotGothic16({ variable: "--font-pixel", weight: "400", subsets: ["latin"], display: "swap", preload: false });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  // サイトは AVERIX が制作（主催は学校・実行委員会）
  authors: [{ name: "AVERIX", url: "https://www.averix.jp/" }],
  creator: "AVERIX",
  openGraph: { type: "website", siteName: "エンカレ夢中万博", locale: "ja_JP" },
  twitter: { card: "summary_large_image" },
  title: { default: "エンカレ夢中万博", template: "%s | エンカレ夢中万博" },
  description: "第1回 エンカレ夢中万博 ― 2026年11月28日（土）10:00〜14:00、広島工業大学 沼田校舎。生徒が夢中になっていることを、展示・発表・お店・体験で表現します。",
};

export const viewport: Viewport = {
  viewportFit: "cover",
  colorScheme: "light dark",
  themeColor: [{ media: "(prefers-color-scheme: dark)", color: "#0f1a33" }, { color: "#bfe4fb" }],
};

// 「文字を大きく」を前に選んだ人は、描く前に大きくしておく（ちらつかないように）。
// ページが見つからないとき（お店の id のまちがいなど）は、Next がサーバーで作った画面を使わずブラウザで画面全体を作り直すので、
// このスクリプトは動かず、html の class も消える。それは TextSizeKeeper が描いた直後に付け直す
const bigScript = `try{if(localStorage.getItem("muchu-big")==="1")document.documentElement.classList.add("big")}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className={`${maru.variable} ${pixel.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: bigScript }} />
      </head>
      <body>
        <a className="skip" href="#main">
          本文へ
        </a>
        <TextSizeKeeper />
        {children}
      </body>
    </html>
  );
}
