import Image from "next/image";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { LiveBoard, LiveShopBadges } from "@/components/live/live-parts";
import { loadAll } from "@/lib/store";

import { EVENT, VENUE } from "@/lib/venue";
import { Countdown } from "./_components/countdown";
import "./home.css";

export default async function HomePage() {
  const { shops, depts } = await loadAll();
  const visible = shops.filter((s) => !s.hidden);
  const names = Object.fromEntries(visible.map((s) => [s.id, { shop: s.name, items: Object.fromEntries(s.menu.map((m) => [m.id, m.name])) }]));
  const marquee = visible.flatMap((s) => (s.menu.length ? s.menu.map((m) => m.name) : [s.name])).slice(0, 14);

  return (
    <>
      {/* 表紙 */}
      <section className="hm-hero">
        <div className="hm-blobs" aria-hidden="true">
          <i className="b1" />
          <i className="b2" />
          <i className="b3" />
        </div>
        <div className="hm-wrap hm-hero-grid">
          <div className="hm-hero-title">
            <p className="hm-pre">
              <span className="no">第1回</span>
              <span className="en">ENCARE MUCHU EXPO 2026</span>
            </p>
            <h1 className="hm-title">
              <span className="t1">エンカレ</span>
              <span className="t2">夢中</span>
              <span className="t3">万博</span>
            </h1>
            <p className="hm-tagline">
              <span>
                つながる<em className="o">夢</em>、
              </span>
              <span>
                広がる<em className="g">未来</em>！
              </span>
            </p>
            <svg className="hm-badge" viewBox="0 0 200 200" aria-hidden="true">
              <defs>
                <path id="ring" d="M100,100 m-74,0 a74,74 0 1,1 148,0 a74,74 0 1,1 -148,0" />
              </defs>
              <circle cx="100" cy="100" r="96" className="bg" />
              <g className="spin">
                <text>
                  <textPath href="#ring" textLength="456" lengthAdjust="spacing">
                    ENCARE ・ MUCHU ・ EXPO ・ 2026 ・
                  </textPath>
                </text>
              </g>
              <text x="100" y="104" textAnchor="middle" className="big">
                11.28
              </text>
              <text x="100" y="132" textAnchor="middle" className="sm">
                SAT
              </text>
            </svg>
          </div>

          <div className="hm-ticket" role="group" aria-label="開催日時と場所">
            <div className="hm-ticket-main">
              <p className="hm-ticket-k">ADMISSION ／ ご案内</p>
              <dl>
                <div>
                  <dt>日時</dt>
                  <dd>
                    <strong>{EVENT.date}</strong>
                    <span>{EVENT.hours}</span>
                  </dd>
                </div>
                <div>
                  <dt>場所</dt>
                  <dd>
                    <strong>{VENUE.name}</strong>
                    <span>〒{VENUE.postal} {VENUE.address}</span>
                  </dd>
                </div>
              </dl>
              <p className="hm-ticket-who">どなたでもお気軽にお越しください</p>
            </div>
            <div className="hm-ticket-stub" aria-live="polite">
              <Countdown />
            </div>
          </div>
        </div>
      </section>

      <div className="hm-marquee-clip" aria-hidden="true">
        <div className="hm-marquee">
          <div className="hm-track">
            {[...marquee, ...marquee].map((t, i) => (
              <span key={i}>
                {t}
                <b>✦</b>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* いまの様子 */}
      <section className="hm-sec" id="now" aria-labelledby="now-h">
        <div className="hm-wrap">
          <p className="hm-eyebrow">LIVE</p>
          <h2 id="now-h" className="hm-h2">
            いまの様子
          </h2>
          <p className="hm-lead">売り切れ・残りわずかの品物と、実行委員からのお知らせです。</p>
          <LiveBoard names={names} />
        </div>
      </section>

      {/* 入口のカード */}
      <section className="hm-sec hm-sec--alt" aria-label="見たいものをえらぶ">
        <div className="hm-wrap hm-doors">
          <Link href="/shops" className="hm-door tone-orange">
            <Icon name="一覧" size={28} />
            <span className="hm-door-t">お店・出し物</span>
            <span className="hm-door-s">メニュー・値段・スケジュール・お店の思い</span>
          </Link>
          <Link href="/map" className="hm-door tone-blue">
            <Icon name="地図" size={28} />
            <span className="hm-door-t">マップ</span>
            <span className="hm-door-s">どの部門がどこにあるか</span>
          </Link>
          <Link href="/info" className="hm-door tone-green">
            <Icon name="情報" size={28} />
            <span className="hm-door-t">ご来場の方へ</span>
            <span className="hm-door-s">無料送迎バス・駐車場・行き方</span>
          </Link>
        </div>
      </section>

      {/* 部門（パビリオン） */}
      <section className="hm-sec" aria-labelledby="pav-h">
        <div className="hm-wrap">
          <p className="hm-eyebrow">PAVILIONS</p>
          <h2 id="pav-h" className="hm-h2">
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

      {/* 夢中万博って？ */}
      <section className="hm-sec hm-sec--alt" aria-labelledby="about-h">
        <div className="hm-wrap hm-about">
          <div>
            <p className="hm-eyebrow">ABOUT</p>
            <h2 id="about-h" className="hm-h2">
              夢中万博って？
            </h2>
            <p className="hm-quote">
              夢中になっていることを、
              <br />
              表現する。
            </p>
            <p>
              「エンカレ祭」と「学習発表会」がひとつになった、<strong>今年はじめての行事</strong>です。体験・エンカレ茶屋・地域の 3 つの部門に分かれた全体での取り組みだけでなく、演奏・絵画・工作・昆虫・古銭など、個人の夢中もさまざまなカタチで表現します。
            </p>
            <p>
              おそろいのバンダナは<strong>白</strong>。「みんなで同じスタート地点から」という想いと、一日の頑張りが見えるように、という理由で選びました。
            </p>
          </div>
          <figure className="hm-poster">
            <Image src="/img/poster.jpg" width={850} height={1200} alt="エンカレ夢中万博のポスター。紅葉の校舎の前で、ギターを持った生徒と絵の具パレットを持った生徒が手を振っている。" />
            <figcaption>ポスター</figcaption>
          </figure>
        </div>
      </section>
    </>
  );
}
