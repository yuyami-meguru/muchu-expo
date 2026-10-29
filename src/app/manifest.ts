import type { MetadataRoute } from "next";

// スマホの「ホーム画面に追加」で、アプリのように開ける
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "エンカレ夢中万博",
    short_name: "夢中万博",
    description: "2026年11月28日（土）10:00〜14:00 広島工業大学 沼田校舎。売り切れ・マップ・タイムテーブル",
    start_url: "/",
    display: "standalone",
    background_color: "#bfe4fb",
    theme_color: "#bfe4fb",
    lang: "ja",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
