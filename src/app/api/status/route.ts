import { NextResponse } from "next/server";
import { loadAll } from "@/lib/store";
import { liveOf } from "@/lib/live";

// みんなの画面が 15 秒ごとに読む「いまの様子」。売り切れ・お店の状態・お知らせだけ（説明文などは入れない）。
// Vercel の CDN に 5 秒だけ置いて、人が多くても Redis を呼びすぎないようにする。
export const dynamic = "force-dynamic";

export async function GET() {
  const data = await loadAll();
  return NextResponse.json(liveOf(data), {
    headers: { "Cache-Control": "public, s-maxage=5, stale-while-revalidate=10" },
  });
}
