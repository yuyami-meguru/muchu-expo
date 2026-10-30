import type { Metadata } from "next";
import { Sprite } from "@/components/pixel/sprites";
import { loadAll, surveyOpen } from "@/lib/store";
import { deptLookup } from "@/lib/types";
import { SurveyForm } from "./survey-form";
import "./survey.css";

export const metadata: Metadata = { title: "アンケート" };

/** 来てくれた人のアンケート（2023 年のエンカレ祭アンケートの 5 問をもとに）。はじめのあいさつは、送れたら隠すので SurveyForm の中 */
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
        {!open && <p className="sv-lead">アンケートの受付は終わりました。たくさんのご回答、ありがとうございました。</p>}
      </header>
      {open ? <SurveyForm shops={choices} /> : <p className="sv-closed">いまはアンケートを受け付けていません。</p>}
    </div>
  );
}
