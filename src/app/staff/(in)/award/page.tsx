import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/card";
import { getSetting, listSurvey, loadAll, storeReady } from "@/lib/store";
import { favCounts, type SurveyAnswer } from "@/lib/survey";
import { deptLookup } from "@/lib/types";
import { AWARD_KEY, parseAward } from "@/app/(public)/award/award-data";
import { adminOnly } from "../_components/admin-only";
import { AwardEditor } from "./award-editor";

export const metadata: Metadata = { title: "夢中アワード" };
export const dynamic = "force-dynamic";

/**
 * 夢中アワードを決めて発表する（実行委員だけ）。賞の名前・数・受賞は自由に変えられる。
 * 参考のアンケートの数は、回答の数と、同じ端末の回答を 1 つに数えた数（続けて何度も答えた分を 1 票に）の両方を出す
 */
export default async function StaffAwardPage() {
  await adminOnly("/staff/award");
  const [raw, { shops, depts }, answers] = await Promise.all([getSetting(AWARD_KEY), loadAll({ fresh: true }), listSurvey()]);
  const dept = deptLookup(depts);
  const visible = shops.filter((s) => !s.hidden);
  const list = answers as SurveyAnswer[];
  // 参考：アンケートの「印象に残った」数（お店の id ごと）
  const all = favCounts(list);
  const byDevice = favCounts(list, true);
  const counts = Object.fromEntries(visible.map((s) => [s.id, all[s.id] ?? 0]));
  const devCounts = Object.fromEntries(visible.map((s) => [s.id, byDevice[s.id] ?? 0]));
  return (
    <div className="st-page st-page--wide st-stack">
      <PageHeader title="夢中アワード" sub="賞の名前・数・受賞するお店は、あとから自由に変えられます。「発表」のスイッチをオンにするまで、お客さんには見えません" />
      <AwardEditor
        initial={parseAward(raw)}
        shops={visible.map((s) => ({ id: s.id, name: s.name, dept: dept(s.dept).short, color: dept(s.dept).color }))}
        counts={counts}
        devCounts={devCounts}
        total={list.length}
        ready={storeReady()}
      />
    </div>
  );
}
