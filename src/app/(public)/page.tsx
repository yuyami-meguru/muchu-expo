import Link from "next/link";
import { Icon } from "@/components/icons";
import { LiveBoard, LiveShopBadges } from "@/components/live/live-parts";
import { Sprite } from "@/components/pixel/sprites";
import { loadAll } from "@/lib/store";
import { EVENT, VENUE } from "@/lib/venue";
import { allSchedule } from "@/lib/schedule";
import { ComingUp } from "./_components/coming-up";
import { Countdown } from "./_components/countdown";
import "./home.css";

const PAMPHLET = "https://www.kodaikoko.ed.jp/encourage/img/mutyubanpaku_261128.pdf";

export default async function HomePage() {
  const { shops, depts } = await loadAll();
  const visible = shops.filter((s) => !s.hidden);
  const names = Object.fromEntries(visible.map((s) => [s.id, { shop: s.name, items: Object.fromEntries(s.menu.map((m) => [m.id, m.name])) }]));
  const { timed } = allSchedule(shops, depts);
  const marquee = visible.flatMap((s) => (s.menu.length ? s.menu.map((m) => m.name) : [s.name])).slice(0, 14);

  return (
    <>
      {/* 表紙（学校のパンフレットの表紙と同じ並び） */}
      <section className="hm-hero">
        <div className="hm-sprites" aria-hidden="true">
          <Sprite name="camera" size={150} className="sp sp-camera" />
          <Sprite name="controller" size={110} className="sp sp-controller" />
          <Sprite name="cube" size={64} className="sp sp-cube" />
          <Sprite name="guitar" size={150} className="sp sp-guitar" />
          <Sprite name="ball" size={110} className="sp sp-ball" />
          <Sprite name="sneaker" size={110} className="sp sp-sneaker" />
          <Sprite name="skate" size={150} className="sp sp-skate" />
          <Sprite name="note" size={40} className="sp sp-note" />
        </div>
        <div className="hm-wrap hm-hero-in">
          <p className="hm-org">{EVENT.organizer}</p>
          <h1 className="hm-title px-title">
            <span className="t1">エンカレ</span>
            <span className="t2">夢中万博</span>
          </h1>
          <dl className="hm-when">
            <div>
              <dt>日時</dt>
              <dd className="hm-date">
                2026.11.28<span className="hm-dow">土</span>
                <span className="hm-hours">{EVENT.hours}</span>
              </dd>
            </div>
            <div>
              <dt>場所</dt>
              <dd className="hm-place">{VENUE.name}</dd>
            </div>
          </dl>
          <p className="hm-count px-box" aria-live="polite">
            <Countdown />
          </p>
          <p className="hm-cta">
            <Link href="/shops" className="hm-btn hm-btn--main">
              ▶ お店・出し物を見る
            </Link>
            <Link href="/info" className="hm-btn">
              行き方・送迎バス
            </Link>
          </p>
        </div>
      </section>

      <div className="hm-marquee" aria-hidden="true">
        <div className="hm-track">
          {[...marquee, ...marquee].map((t, i) => (
            <span key={i}>
              {t}
              <b>◆</b>
            </span>
          ))}
        </div>
      </div>

      {/* いまの様子 */}
      <section className="hm-sec" id="now" aria-labelledby="now-h">
        <div className="hm-wrap">
          <h2 id="now-h" className="hm-h2 px-title">
            いまの様子
          </h2>
          <p className="hm-lead">売り切れ・残りわずかの品物と、実行委員からのお知らせです。</p>
          <LiveBoard names={names} />
          <ComingUp rows={timed} />
        </div>
      </section>

      {/* 入口のカード */}
      <section className="hm-sec hm-sec--alt" aria-label="見たいものをえらぶ">
        <div className="hm-wrap hm-doors">
          <Link href="/shops" className="hm-door tone-green">
            <Sprite name="cube" size={40} />
            <span className="hm-door-t">お店・出し物</span>
            <span className="hm-door-s">メニュー・値段・スケジュール・お店の思い</span>
          </Link>
          <Link href="/map" className="hm-door tone-blue">
            <Sprite name="controller" size={44} />
            <span className="hm-door-t">マップ</span>
            <span className="hm-door-s">どの部門がどこにあるか</span>
          </Link>
          <Link href="/info" className="hm-door tone-purple">
            <Sprite name="sneaker" size={44} />
            <span className="hm-door-t">ご来場の方へ</span>
            <span className="hm-door-s">無料送迎バス・駐車場・行き方</span>
          </Link>
        </div>
      </section>

      {/* 部門 */}
      <section className="hm-sec" aria-labelledby="pav-h">
        <div className="hm-wrap">
          <h2 id="pav-h" className="hm-h2 px-title">
            部門
          </h2>
          <div className="hm-pavs">
            {depts
              .filter((d) => visible.some((s) => s.dept === d.id))
              .map((d, i) => {
                const list = visible.filter((s) => s.dept === d.id);
                return (
                  <div key={d.id} className={`hm-pav tone-${d.color}`}>
                    <div className="hm-pav-head">
                      <span className="hm-pav-no">{String(i + 1).padStart(2, "0")}</span>
                      <h3>{d.name}</h3>
                      {d.tagline && <p>{d.tagline}</p>}
                    </div>
                    <ul>
                      {list.map((s) => (
                        <li key={s.id}>
                          <Link href={`/shops/${s.id}`}>
                            <span className="hm-pav-name">{s.name}</span>
                            <LiveShopBadges shopId={s.id} />
                            <Icon name="右へ" size={18} />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
          </div>
        </div>
      </section>

      {/* エンカレ夢中万博ってなに？（パンフレットの文） */}
      <section className="hm-sec hm-sec--alt" aria-labelledby="about-h">
        <div className="hm-wrap">
          <div className="hm-about">
            <h2 id="about-h" className="hm-h2 px-title">
              エンカレ夢中万博ってなに？
            </h2>
            <p>
              「エンカレ夢中万博」は、生徒たちの<strong>夢中を表現する</strong>行事です。
            </p>
            <p>体験・エンカレ茶屋・地域の 3 つの部門に分かれた全体での取り組みだけでなく、演奏、絵画、工作、昆虫、古銭など、個人の夢中もさまざまなカタチで表現する予定です。</p>
            <p>エンカレ夢中万博を通して、生徒たちのさまざまな夢中をぜひご覧ください。</p>
            <p className="hm-links">
              <a href={PAMPHLET} target="_blank" rel="noopener noreferrer">
                パンフレット（PDF）
              </a>
              <a href={EVENT.instagram} target="_blank" rel="noopener noreferrer">
                準備の様子（Instagram）
              </a>
            </p>
            <Sprite name="paint" size={56} className="hm-about-sp" />
          </div>
        </div>
      </section>
    </>
  );
}
