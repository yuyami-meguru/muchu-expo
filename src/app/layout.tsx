import type { Metadata, Viewport } from "next";
import { Dela_Gothic_One, Yusei_Magic, Zen_Maru_Gothic } from "next/font/google";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

// 本文はまる文字（読みやすさ）、題字は太いゴシック、ひとことは手書き風（ポスターの雰囲気）
const maru = Zen_Maru_Gothic({ variable: "--font-maru", weight: ["500", "700", "900"], subsets: ["latin"], display: "swap" });
const dela = Dela_Gothic_One({ variable: "--font-dela", weight: "400", subsets: ["latin"], display: "swap" });
const yusei = Yusei_Magic({ variable: "--font-yusei", weight: "400", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  openGraph: { type: "website", siteName: "エンカレ夢中万博", locale: "ja_JP", images: ["/img/poster.jpg"] },
  title: { default: "エンカレ夢中万博", template: "%s | エンカレ夢中万博" },
  description: "第1回 エンカレ夢中万博 ― 2026年11月28日（土）10:00〜14:00、広島工業大学 沼田校舎。生徒が夢中になっていることを、展示・発表・お店・体験で表現します。",
};

export const viewport: Viewport = {
  viewportFit: "cover",
  colorScheme: "light dark",
  themeColor: [{ media: "(prefers-color-scheme: dark)", color: "#1c1712" }, { color: "#fbf3e4" }],
};

// 「文字を大きく」を前に選んだ人は、描く前に大きくしておく（ちらつかないように）
const bigScript = `try{if(localStorage.getItem("muchu-big")==="1")document.documentElement.classList.add("big")}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className={`${maru.variable} ${dela.variable} ${yusei.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: bigScript }} />
      </head>
      <body>
        <a className="skip" href="#main">本文へ</a>
        {children}
      </body>
    </html>
  );
}
