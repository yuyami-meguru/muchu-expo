import { NextResponse } from "next/server";
import { fail } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { loadAll } from "@/lib/store";

export const dynamic = "force-dynamic";

/**
 * データの控え（実行委員だけ）。部門・お店・場所・フロア・お知らせを JSON のファイルで渡す。
 * お店の編集用のかぎ（muchu:key）は入れない（控えのファイルが人の手に渡っても、お店の画面に入れないように）。
 */
export async function GET() {
  const s = await getSession();
  if (s?.role !== "admin") return fail(403, "実行委員の合言葉でログインしてください");
  const { depts, shops, places, areas, news } = await loadAll({ fresh: true });
  const jst = new Date(Date.now() + 9 * 3600e3).toISOString();
  const stamp = `${jst.slice(0, 10).replace(/-/g, "")}-${jst.slice(11, 16).replace(":", "")}`;
  const body = {
    app: "muchu-expo",
    version: process.env.NEXT_PUBLIC_APP_VERSION ?? "",
    exportedAt: new Date().toISOString(),
    depts,
    // お知らせを出した時刻（noticeAt）は当日の目安で、控えから戻すと付け直すので入れない
    shops: shops.map((shop) => {
      const c = { ...shop };
      delete c.noticeAt;
      return c;
    }),
    places,
    areas,
    news,
  };
  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="muchu-backup-${stamp}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
