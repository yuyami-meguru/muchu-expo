import type { Metadata } from "next";
import Link from "next/link";
import { allSchedule } from "@/lib/schedule";
import { loadAll } from "@/lib/store";
import { EVENT } from "@/lib/venue";
import { ScheduleList } from "./schedule-list";
import "./schedule.css";

export const metadata: Metadata = { title: "タイムテーブル" };

/** 全部のお店の「当日の流れ」を時刻の順に 1 本にまとめる（お店の状態の札は出さない。時刻の表に集中する） */
export default async function SchedulePage() {
  const { shops, depts } = await loadAll();
  const { timed, other } = allSchedule(shops, depts);

  return (
    <div className="sc-wrap">
      <header className="sc-head">
        <p className="sc-eyebrow">TIME TABLE</p>
        <h1 className="sc-h1">タイムテーブル</h1>
        <p className="sc-lead">
          {EVENT.date} {EVENT.hours}。発表や演奏、お店の時間を、時刻の順にまとめました。時間は変わることがあります。
        </p>
      </header>

      {timed.length === 0 && other.length === 0 && <p className="sc-empty">時刻の決まった出し物は、まだありません。決まりしだいお知らせします。</p>}

      {timed.length > 0 && <ScheduleList rows={timed} />}

      {other.length > 0 && (
        <section className="sc-other" aria-labelledby="sc-other-h">
          <h2 id="sc-other-h">時刻が決まっていないもの・一日じゅう開いているもの</h2>
          <ul className="sc-list">
            {other.map((r, i) => (
              <li key={i} className={`tone-${r.color}`}>
                <span className="sc-time">{r.time || "—"}</span>
                <Link href={`/shops/${r.shopId}`} className="sc-body">
                  <span className="sc-text">{r.text}</span>
                  <span className="sc-shop">
                    {r.deptShort} ・ {r.shopName}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
