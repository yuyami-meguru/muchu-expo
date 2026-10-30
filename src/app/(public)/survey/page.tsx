import type { Metadata } from "next";
import { Sprite } from "@/components/pixel/sprites";
import { loadAll, surveyOpen } from "@/lib/store";
import { deptLookup } from "@/lib/types";
import { SurveyForm } from "./survey-form";
import "./survey.css";

export const metadata: Metadata = { title: "アンケート" };

/** 来てくれた人のアンケート（2023 年のエンカレ祭アンケートの 5 問をもとに） */
export default async function SurveyPage() {
  const [{ shops, depts }, open] = await Promise.all([loadAll(), surveyOpen()]);
  const dept = deptLookup(depts);
  const choices = shops
    .filter((s) => !s.hidden)
    .map((s) => ({ id: s.id, name: s.name, dept: dept(s.dept).short, color: dept(s.dept).color }));
  return (
    <div className="sv-wrap">
      <header className="sv-head">
        <Sprite name="note" size={40} className="sv-sp" />
        <p className="sv-eyebrow">QUESTIONNAIRE</p>
        <h1 className="sv-h1">アンケート</h1>
        <p className="sv-lead">
          本日はエンカレ夢中万博にお越しいただき、ありがとうございます。よりよい行事にするために、アンケートへのご協力をお願いします。
          <br />
          <strong>どの問いも、答えられるものだけで大丈夫です。</strong>お名前や連絡先はうかがいません。
        </p>
      </header>
      {open ? (
        <SurveyForm shops={choices} />
      ) : (
        <p className="sv-closed">アンケートの受付は終わりました。ご協力ありがとうございました。</p>
      )}
    </div>
  );
}
