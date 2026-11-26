import type { Metadata } from "next";
import Link from "next/link";
import { Sprite } from "@/components/pixel/sprites";
import { getSession } from "@/lib/auth";
import { getSetting, loadAll, surveyOpen } from "@/lib/store";
import { AWARD_KEY, isAwardTarget, parseAward } from "../award/award-data";
import { deptLookup } from "@/lib/types";
import { ByPhase } from "../_components/in-phase";
import { isSolo, SoloPage } from "@/components/shell/solo-page";
import { SurveyForm } from "./survey-form";
import "./survey.css";

export const metadata: Metadata = { title: "アンケート" };

/**
 * 来てくれた人のアンケート（2023 年のエンカレ祭アンケートの 5 問をもとに）。はじめのあいさつは、送れたら隠すので SurveyForm の中。
 * 開催前は答えようがないので、問いは出さずに「当日からお願いします」（送る API でも断る。練習で表示の時期を「当日」にしたときは出る）
 */
export default async function SurveyPage({ searchParams }: { searchParams: Promise<{ solo?: string }> }) {
  // ?solo=1 はパンフの QR（アンケート・夢中アワード）から開いたとき。メニューを出さずにアンケートだけ（solo-page.tsx）
  const { solo } = await searchParams;
  const [{ shops, depts }, open, awardRaw, session] = await Promise.all([loadAll(), surveyOpen(), getSetting(AWARD_KEY), getSession()]);
  // 実行委員としてログインしている人は、開催前・受付を止めているあいだも下見できる（送っても保存しない）
  const preview = session?.role === "admin";
  const dept = deptLookup(depts);
  const choices = shops
    .filter((s) => !s.hidden)
    .map((s) => ({ id: s.id, name: s.name, dept: dept(s.dept).short, color: dept(s.dept).color }));
  // 夢中アワードの投票：賞（名前と基準）と、対象の個人の展示（無ければ全部のお店）
  // 夢中アワードを発表したあとは、問 5（投票）を出さない（発表のあとに票が増えないように。2026-11-26 の点検）
  const awardSetting = parseAward(awardRaw);
  const awards = awardSetting.published ? [] : awardSetting.awards.map((x) => ({ id: x.id, name: x.name, note: x.note }));
  // 候補は個人の展示（教科展示は外す。award-data.ts の isAwardTarget）
  const kojin = choices.filter((c) => {
    const s = shops.find((x) => x.id === c.id);
    return !!s && isAwardTarget(s);
  });
  const form = <SurveyForm shops={choices} awards={awards} candidates={kojin.length ? kojin : choices} />;
  const previewForm = <SurveyForm shops={choices} awards={awards} candidates={kojin.length ? kojin : choices} preview />;
  return (
    <div className="sv-wrap">
      <SoloPage on={isSolo(solo)} />
      <header className="sv-head">
        <Sprite name="note" size={40} className="sv-sp" />
        <p className="sv-eyebrow" aria-hidden="true">
          QUESTIONNAIRE
        </p>
        <h1 className="sv-h1">アンケート</h1>
      </header>
      <ByPhase
        before={
          preview ? (
            previewForm
          ) : (
          <div className="sv-closed">
            <p>アンケートは、当日（11/28）からお願いします。</p>
            <p className="sv-closed-sub">会場でお楽しみいただいたあとに、このページから答えられます。</p>
            <p className="sv-done-links">
              <Link href="/shops">お店・出し物を見る</Link>
              <Link href="/info">ご来場の方へ（行き方・送迎バス）</Link>
            </p>
          </div>
          )
        }
        day={open ? form : preview ? previewForm : <p className="sv-closed">いまはアンケートを受け付けていません。</p>}
        after={open ? form : preview ? previewForm : <p className="sv-closed">アンケートの受付は終わりました。たくさんのご回答、ありがとうございました。</p>}
      />
    </div>
  );
}
