import type { Metadata } from "next";
import { allSchedule } from "@/lib/schedule";
import { loadAll } from "@/lib/store";
import { EVENT } from "@/lib/venue";
import { ScheduleList, ScheduleRow } from "./schedule-list";
import "./schedule.css";

export const metadata: Metadata = { title: "タイムテーブル" };

/**
 * 全部のお店の「当日の流れ」を時刻の順に 1 本にまとめる（お店の状態の札は出さない。時刻の表に集中する）。
 * 行にはお店の場所も出す（押すとマップ）。場所はお店ごとの場所なので、場所のちがう予定は別のお店・出し物として登録してもらう
 */
export default async function SchedulePage() {
  const { shops, depts, places, areas } = await loadAll();
  const { timed, other } = allSchedule(shops, depts, { places, areas });

  return (
    <div className="sc-wrap">
      <header className="sc-head">
        <p className="sc-eyebrow" aria-hidden="true">
          TIME TABLE
        </p>
        <h1 className="sc-h1 px-title">タイムテーブル</h1>
        <p className="sc-lead">
          <span className="keep">{EVENT.date}</span> <span className="nowrap">{EVENT.hours}</span>。発表や演奏、お店の時間を、時刻の順にまとめました。時間は変わることがあります。
        </p>
      </header>

      {timed.length === 0 && other.length === 0 && <p className="sc-empty">予定は、まだありません。決まりしだいお知らせします。</p>}

      {timed.length > 0 && <ScheduleList rows={timed} />}

      {other.length > 0 && (
        <section className="sc-other" aria-labelledby="sc-other-h">
          <h2 id="sc-other-h">時刻が決まっていないもの・一日じゅう開いているもの</h2>
          <ul className="sc-list">
            {other.map((r, i) => (
              <ScheduleRow key={i} r={r} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
