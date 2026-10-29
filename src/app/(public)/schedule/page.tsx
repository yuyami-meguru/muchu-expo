import type { Metadata } from "next";
import Link from "next/link";
import { LiveShopBadges } from "@/components/live/live-parts";
import { loadAll } from "@/lib/store";
import { deptLookup } from "@/lib/types";
import { minutesOf } from "@/lib/schedule";
import { EVENT } from "@/lib/venue";
import { NowMark } from "./now-mark";
import "./schedule.css";

export const metadata: Metadata = { title: "タイムテーブル" };

/** 全部のお店の「当日の流れ」を時刻の順に 1 本にまとめる */
export default async function SchedulePage() {
  const { shops, depts } = await loadAll();
  const dept = deptLookup(depts);
  const rows = shops
    .filter((s) => !s.hidden)
    .flatMap((s) => s.schedule.map((x) => ({ shop: s, time: x.time, text: x.text, min: minutesOf(x.time) })));
  const timed = rows.filter((r) => r.min !== null).sort((a, b) => a.min! - b.min! || a.shop.order - b.shop.order);
  const other = rows.filter((r) => r.min === null);

  return (
    <div className="sc-wrap">
      <header className="sc-head">
        <p className="sc-eyebrow">TIME TABLE</p>
        <h1 className="sc-h1">タイムテーブル</h1>
        <p className="sc-lead">
          {EVENT.date} {EVENT.hours}。発表や演奏、お店の時間を、時刻の順にまとめました。時間は変わることがあります。
        </p>
      </header>

      {timed.length === 0 && other.length === 0 && <p className="sc-empty">時間の決まった出し物は、まだありません。決まり次第ここに出ます。</p>}

      {timed.length > 0 && (
        <ol className="sc-list">
          {timed.map((r, i) => (
            <li key={i} className={`tone-${dept(r.shop.dept).color}`} data-min={r.min!}>
              <NowMark min={r.min!} next={timed[i + 1]?.min ?? null} />
              <span className="sc-time">{r.time}</span>
              <Link href={`/shops/${r.shop.id}`} className="sc-body">
                <span className="sc-text">{r.text}</span>
                <span className="sc-shop">
                  {dept(r.shop.dept).short} ・ {r.shop.name}
                </span>
                <LiveShopBadges shopId={r.shop.id} />
              </Link>
            </li>
          ))}
        </ol>
      )}

      {other.length > 0 && (
        <section className="sc-other" aria-labelledby="sc-other-h">
          <h2 id="sc-other-h">時刻がまだのもの・一日中</h2>
          <ul className="sc-list">
            {other.map((r, i) => (
              <li key={i} className={`tone-${dept(r.shop.dept).color}`}>
                <span className="sc-time">{r.time || "—"}</span>
                <Link href={`/shops/${r.shop.id}`} className="sc-body">
                  <span className="sc-text">{r.text}</span>
                  <span className="sc-shop">
                    {dept(r.shop.dept).short} ・ {r.shop.name}
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
