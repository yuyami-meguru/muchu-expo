import { NextResponse, type NextRequest } from "next/server";
import { loadAll, publicRead } from "@/lib/store";
import { liveOf } from "@/lib/live";
import { LIVE_TIMING, phaseOf } from "@/lib/ops";
import { loadPublicOps } from "@/lib/ops-server";

// みんなの画面が読み直す「いまの様子」。売り切れ・お店の状態・お知らせ・ラジオの ON AIR だけ（説明文などは入れない）。
// Vercel の CDN に表示の時期に合わせた秒数だけ置き（開催中 3 秒・開催前 60 秒。ops.ts の LIVE_TIMING）、
// サーバーの中でも同じ古さまで使い回して、人が多くても Redis を呼びすぎないようにする（開催中は、お店が押してからお客さんの画面に出るまで長くて 20 秒ほど）。
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // ? を付けると CDN の置き場を外れて、毎回ここまで来てしまう（いたずらで Upstash の枠を使い切られる）。
  // 画面は ? を付けないので、Redis には通さず ? の無いアドレスへ回す
  if (req.nextUrl.search) {
    return NextResponse.redirect(new URL("/api/status", req.nextUrl.origin), { status: 308, headers: { "Cache-Control": "public, max-age=3600" } });
  }
  const read = publicRead();
  const [data, { ops, radio }] = await Promise.all([loadAll({ read }), loadPublicOps({ read })]);
  const live = liveOf(data, radio, ops);
  const t = LIVE_TIMING[phaseOf(live.at, ops.phase)];
  return NextResponse.json(live, {
    headers: { "Cache-Control": `public, s-maxage=${t.cdnSec}, stale-while-revalidate=${t.swrSec}` },
  });
}
