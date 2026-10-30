import { NextResponse } from "next/server";
import { loadAll } from "@/lib/store";
import { liveOf } from "@/lib/live";
import { loadPublicOps } from "@/lib/ops-server";

// みんなの画面が 15 秒ごとに読む「いまの様子」。売り切れ・お店の状態・お知らせ・ラジオの ON AIR だけ（説明文などは入れない）。
// Vercel の CDN に 3 秒だけ置いて、人が多くても Redis を呼びすぎないようにする（お店が押してから、お客さんの画面に出るまで長くて 20 秒ほど）。
export const dynamic = "force-dynamic";

export async function GET() {
  const [data, { ops, radio }] = await Promise.all([loadAll(), loadPublicOps()]);
  return NextResponse.json(liveOf(data, radio, ops), {
    headers: { "Cache-Control": "public, s-maxage=3, stale-while-revalidate=5" },
  });
}
