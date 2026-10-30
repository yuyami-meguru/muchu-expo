import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { fail, guarded, ok, readBody, sameOrigin } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { clearSurvey, listSurvey, loadAll, setSurveyOpen } from "@/lib/store";
import { toCsv, type SurveyAnswer } from "@/lib/survey";

/* アンケートの集計の窓口（実行委員・先生だけ） */

async function adminOr403() {
  const s = await getSession();
  return s?.role === "admin" ? null : fail(403, "実行委員の合言葉でログインしてください");
}

/** 回答を表（CSV）で書き出す */
export async function GET() {
  return guarded(async () => {
    const no = await adminOr403();
    if (no) return no;
    const { shops } = await loadAll();
    const names = Object.fromEntries(shops.map((s) => [s.id, s.name]));
    const answers = (await listSurvey()) as SurveyAnswer[];
    const jst = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 16).replace(/[-:T]/g, "");
    return new NextResponse(toCsv(answers.slice().reverse(), names), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="muchu-survey-${jst}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  });
}

/** 受付のオン・オフ */
export async function PUT(req: NextRequest) {
  return guarded(async () => {
    const no = await adminOr403();
    if (no) return no;
    const b = await readBody(req, z.object({ open: z.boolean() }));
    if ("error" in b) return b.error;
    await setSurveyOpen(b.data.open);
    return ok({ open: b.data.open });
  });
}

/** 回答を全部消す（ためしに答えた分を、当日の前に消す）。{confirm:"消す"} が要る */
export async function DELETE(req: NextRequest) {
  return guarded(async () => {
    if (!sameOrigin(req)) return fail(403, "このサイトの画面から操作してください");
    const no = await adminOr403();
    if (no) return no;
    const b = await readBody(req, z.object({ confirm: z.literal("消す") }));
    if ("error" in b) return fail(400, "確認の言葉がちがいます");
    await clearSurvey();
    return ok();
  });
}
