import type { NextConfig } from "next";
import { execSync } from "node:child_process";
import pkg from "./package.json";

// バージョン（package.json の version）と、作ったときのコミット（Vercel なら VERCEL_GIT_COMMIT_SHA、手元なら git）
function commitShort() {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA;
  if (sha) return sha.slice(0, 7);
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "";
  }
}

// すべての画面に付けるヘッダー（AVERIX と同じ。他のサイトに埋め込ませない・種類のすり替えを防ぐ）
const securityHeaders = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // browsing-topics は今の Chrome が知らない名前で、全部のページのコンソールに警告が出るので入れない
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
    NEXT_PUBLIC_APP_COMMIT: commitShort(),
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // サービスワーカーはいつも新しいものを確かめる（古いものが残って更新されない、を防ぐ）
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }, { key: "Service-Worker-Allowed", value: "/" }] },
      // 従業員側と QR の入口は検索エンジンに載せない。お店の QR のかぎがほかのサイトへ漏れないよう Referrer も送らない
      { source: "/(staff|join|api)(.*)", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }, { key: "Referrer-Policy", value: "no-referrer" }] },
    ];
  },
};

export default nextConfig;
