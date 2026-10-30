import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/card";
import { phaseOf } from "@/lib/ops";
import { listSurvey, loadAll, storeReady, surveyOpen } from "@/lib/store";
import { summarize, type SurveyAnswer } from "@/lib/survey";
import { adminOnly } from "../_components/admin-only";
import { loadAdminOps, serverNow } from "../_components/staff-settings";
import { SurveyTools } from "./survey-tools";
import "./survey-results.css";

export const metadata: Metadata = { title: "アンケートの集計" };
export const dynamic = "force-dynamic";

const fmt = (at: number) => new Date(at).toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo" });

/**
 * 横の棒グラフ（1 色。数は棒の右に書く。棒にマウスを当てると数と割合）。
 * alt を渡すと、数の下に「端末で数えると N」（同じ端末の回答を 1 つに数えた数）も出す
 */
function Bars({ rows, total, label, alt }: { rows: { label: string; n: number }[]; total: number; label: string; alt?: Record<string, number> }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <table className="sr-bars" aria-label={label}>
      <tbody>
        {rows.map((r) => {
          const pct = total ? Math.round((r.n / total) * 100) : 0;
          return (
            <tr key={r.label} title={`${r.label}：${r.n} 件（回答の ${pct}%）`}>
              <th scope="row">{r.label}</th>
              <td>
                <span className="sr-track">
                  <span className="sr-bar" style={{ width: `${(r.n / max) * 100}%` }} />
                </span>
              </td>
              <td className="sr-n">
                {r.n}
                <small>{pct}%</small>
                {alt && alt[r.label] !== undefined && alt[r.label] !== r.n && <small className="sr-alt">端末で {alt[r.label]}</small>}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function Texts({ items, empty }: { items: { at: number; text: string; who?: string }[]; empty: string }) {
  if (!items.length) return <p className="sr-empty">{empty}</p>;
  return (
    <ul className="sr-texts">
      {items.map((x, i) => (
        <li key={i}>
          <span className="sr-meta">
            {fmt(x.at)}
            {x.who ? ` ・ ${x.who}` : ""}
          </span>
          {x.text}
        </li>
      ))}
    </ul>
  );
}

/**
 * アンケートの集計（実行委員・先生だけ）。
 * 同じ端末から何度も答えた分を 1 つに数えた数（端末で数えると）も出す（夢中アワードの参考に。端末の印が無い古い回答は 1 つずつ数える）
 */
export default async function SurveyResultsPage() {
  await adminOnly("/staff/survey");
  const [{ shops }, raw, open, ops] = await Promise.all([loadAll({ fresh: true }), listSurvey(), surveyOpen(), loadAdminOps()]);
  const answers = raw as SurveyAnswer[];
  const names = Object.fromEntries(shops.filter((s) => !s.hidden).map((s) => [s.id, s.name]));
  const s = summarize(answers, names);
  const answeredWho = s.total - s.whoBlank;
  const favAlt = Object.fromEntries(s.favByDevice.map((r) => [r.label, r.n]));
  // 開催前は、受付をオンにしていても、お客さんは答えられない（11/28 の当日から。練習で表示の時期を「当日」にしたときは答えられる）
  const before = phaseOf(serverNow(), ops.phase) === "before";

  return (
    <div className="st-page st-page--wide st-stack sr">
      <PageHeader title="アンケートの集計" sub="来てくれた人のアンケートの結果です。実行委員と先生だけが見られます" />

      <div className="sr-top">
        <div className="sr-stat">
          <span className="sr-stat-l">回答の数</span>
          <span className="sr-stat-v">{s.total}</span>
          <span className="sr-stat-u">件</span>
          {s.total > 0 && (
            <span className="sr-stat-alt">
              同じ端末の回答を 1 つに数えると <strong>{s.totalByDevice}</strong> 件
            </span>
          )}
        </div>
        <SurveyTools open={open} total={s.total} ready={storeReady()} before={before} />
      </div>

      {s.total === 0 ? (
        <p className="sr-empty sr-card">
          まだ回答はありません。お客さんのページは「/survey」です（ホーム・ページのいちばん下・会場に貼るポスターから開けます）。
          {before && "開催前は、お客さんは答えられません（11/28 の当日から受け付けます）。"}
        </p>
      ) : (
        <div className="sr-grid">
          <section className="sr-card">
            <h2>
              <span className="sr-no">1</span>あなたについて
            </h2>
            <p className="sr-sub">
              答えた人 {answeredWho} 人・答えなかった人 {s.whoBlank} 人（割合は答えた人の中で）
            </p>
            <Bars rows={s.who} total={answeredWho} label="あなたについて" />
          </section>

          <section className="sr-card">
            <h2>
              <span className="sr-no">2</span>知ったきっかけ（いくつでも）
            </h2>
            <p className="sr-sub">割合は回答 {s.total} 件の中で</p>
            <Bars rows={s.how} total={s.total} label="知ったきっかけ" />
            <h3>その他</h3>
            <Texts items={s.howOther} empty="なし" />
          </section>

          <section className="sr-card">
            <h2>
              <span className="sr-no">3</span>ここまで来た方法（いくつでも）
            </h2>
            <p className="sr-sub">割合は回答 {s.total} 件の中で</p>
            <Bars rows={s.transport} total={s.total} label="ここまで来た方法" />
            <h3>その他</h3>
            <Texts items={s.transportOther} empty="なし" />
          </section>

          <section className="sr-card">
            <h2>
              <span className="sr-no">4</span>印象に残ったお店・出し物
            </h2>
            <p className="sr-sub">
              多い順。割合は回答 {s.total} 件の中で（夢中アワードの参考に）。「端末で」は、同じ端末から何度答えても 1 票に数えた数です
            </p>
            <Bars rows={s.fav} total={s.total} label="印象に残ったお店・出し物" alt={favAlt} />
            <h3>よかったところ・ほかに印象に残ったもの（{s.favText.length} 件）</h3>
            <Texts items={s.favText} empty="なし" />
          </section>

          <section className="sr-card sr-wide">
            <h2>
              <span className="sr-no">5</span>ご感想（{s.impression.length} 件・新しい順）
            </h2>
            <Texts items={s.impression} empty="まだありません" />
          </section>

          <section className="sr-card">
            <h2>回答が来た時間</h2>
            <p className="sr-sub">日本時間・1 時間ごと</p>
            <Bars rows={s.hours} total={s.total} label="回答が来た時間" />
          </section>
        </div>
      )}
    </div>
  );
}
