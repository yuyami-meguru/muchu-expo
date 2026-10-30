import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/card";
import { getSetting, listSurvey, loadAll, storeReady } from "@/lib/store";
import { summarize, type SurveyAnswer } from "@/lib/survey";
import { deptLookup } from "@/lib/types";
import { AWARD_KEY, parseAward } from "@/app/(public)/award/award-data";
import { adminOnly } from "../_components/admin-only";
import { AwardEditor } from "./award-editor";

export const metadata: Metadata = { title: "夢中アワード" };
export const dynamic = "force-dynamic";

/** 夢中アワードを決めて発表する（実行委員だけ）。賞の名前・数・受賞は自由に変えられる */
export default async function StaffAwardPage() {
  await adminOnly();
  const [raw, { shops, depts }, answers] = await Promise.all([getSetting(AWARD_KEY), loadAll({ fresh: true }), listSurvey()]);
  const dept = deptLookup(depts);
  const visible = shops.filter((s) => !s.hidden);
  const names = Object.fromEntries(visible.map((s) => [s.id, s.name]));
  const sum = summarize(answers as SurveyAnswer[], names);
  // 参考：アンケートの「印象に残った」数（お店の id ごと。多い順）
  const counts = Object.fromEntries(visible.map((s) => [s.id, (answers as SurveyAnswer[]).filter((a) => a.fav?.includes(s.id)).length]));
  return (
    <div className="st-page st-page--wide st-stack">
      <PageHeader title="夢中アワード" sub="賞の名前・数・受賞するお店は、あとから自由に変えられます。「発表」のスイッチをオンにするまで、お客さんには見えません" />
      <AwardEditor
        initial={parseAward(raw)}
        shops={visible.map((s) => ({ id: s.id, name: s.name, dept: dept(s.dept).short, color: dept(s.dept).color }))}
        counts={counts}
        total={sum.total}
        ready={storeReady()}
      />
    </div>
  );
}
