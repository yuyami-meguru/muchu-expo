import type { Metadata } from "next";
import Link from "next/link";
import { Sprite } from "@/components/pixel/sprites";
import { loadAll, surveyOpen } from "@/lib/store";
import { deptLookup } from "@/lib/types";
import { ByPhase } from "../_components/in-phase";
import { SurveyForm } from "./survey-form";
import "./survey.css";

export const metadata: Metadata = { title: "アンケート" };

/**
 * 来てくれた人のアンケート（2023 年のエンカレ祭アンケートの 5 問をもとに）。はじめのあいさつは、送れたら隠すので SurveyForm の中。
 * 開催前は答えようがないので、問いは出さずに「当日からお願いします」（送る API でも断る。練習で表示の時期を「当日」にしたときは出る）
 */
export default async function SurveyPage() {
  const [{ shops, depts }, open] = await Promise.all([loadAll(), surveyOpen()]);
  const dept = deptLookup(depts);
  const choices = shops
    .filter((s) => !s.hidden)
    .map((s) => ({ id: s.id, name: s.name, dept: dept(s.dept).short, color: dept(s.dept).color }));
  const form = <SurveyForm shops={choices} />;
  return (
    <div className="sv-wrap">
      <header className="sv-head">
        <Sprite name="note" size={40} className="sv-sp" />
        <p className="sv-eyebrow" aria-hidden="true">
          QUESTIONNAIRE
        </p>
        <h1 className="sv-h1">アンケート</h1>
      </header>
      <ByPhase
        before={
          <div className="sv-closed">
            <p>アンケートは、当日（11/28）からお願いします。</p>
            <p className="sv-closed-sub">会場でお楽しみいただいたあとに、このページから答えられます。</p>
            <p className="sv-done-links">
              <Link href="/shops">お店・出し物を見る</Link>
              <Link href="/info">ご来場の方へ（行き方・送迎バス）</Link>
            </p>
          </div>
        }
        day={open ? form : <p className="sv-closed">いまはアンケートを受け付けていません。</p>}
        after={open ? form : <p className="sv-closed">アンケートの受付は終わりました。たくさんのご回答、ありがとうございました。</p>}
      />
    </div>
  );
}
