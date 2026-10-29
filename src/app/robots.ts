import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// お客さん側だけ検索エンジンに載せる。従業員側・QR の入口・API は載せない
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/staff", "/join", "/api"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
