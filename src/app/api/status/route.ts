import { NextResponse } from "next/server";
import { loadAll } from "@/lib/store";
import { liveOf } from "@/lib/live";
import { radioLive } from "@/lib/radio";
import { loadRadio } from "@/lib/radio-server";

// みんなの画面が 15 秒ごとに読む「いまの様子」。売り切れ・お店の状態・お知らせ・ラジオの ON AIR だけ（説明文などは入れない）。
// Vercel の CDN に 5 秒だけ置いて、人が多くても Redis を呼びすぎないようにする。
export const dynamic = "force-dynamic";

export async function GET() {
  const [data, radio] = await Promise.all([loadAll(), loadRadio()]);
  return NextResponse.json(liveOf(data, radioLive(radio)), {
    headers: { "Cache-Control": "public, s-maxage=5, stale-while-revalidate=10" },
  });
}
