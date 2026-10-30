import type { Metadata } from "next";
import { AccessMap } from "@/components/access/map-buttons";
import { EVENT, VENUE } from "@/lib/venue";
import "./info.css";

export const metadata: Metadata = { title: "ご来場の方へ" };

// 行き方・送迎バスの時刻は、学校が出したパンフレット（2026-10）と同じ
const NOTES = [
  { k: "坂", t: "正門から会場（知育館）まで坂道を約 10 分", d: "歩きやすい靴でお越しください。お車の方は、坂の途中の駐車場をご利用いただけます。", c: "tone-brown" },
  { k: "音", t: "大きな音がする場所があります", d: "演奏や校内放送があります。音に敏感な方は、イヤーマフなどをお持ちください。", c: "tone-blue" },
  { k: "子", t: "小さなお子さまは保護者の方と一緒に", d: "射的では輪ゴムを使います。的に向けて、人には向けないでください。", c: "" },
  { k: "火", t: "火を使うお店があります", d: "焼き芋や焼きそばなど、屋外で火や鉄板を使います。お店のまわりではお気をつけください。", c: "tone-red" },
  { k: "食", t: "食物アレルギーについて", d: "使っている材料は、お店の生徒におたずねください。", c: "tone-green" },
];

const BUS_FROM_STATION = ["9:50", "10:20", "10:50", "11:20", "11:50", "12:20"];
const BUS_FROM_SCHOOL = ["10:40", "11:10", "11:40", "12:10", "13:10", "13:40", "14:10"];

export default function InfoPage() {
  return (
    <div className="if-wrap">
      <header className="if-head">
        <p className="if-eyebrow">INFORMATION</p>
        <h1 className="if-h1">ご来場の方へ</h1>
        <p className="if-when">
          <strong>{EVENT.date}</strong> {EVENT.hours}
          <br />
          {VENUE.name}
        </p>
      </header>
      <ul className="if-notes">
        {NOTES.map((n) => (
          <li key={n.k}>
            <span className={`if-kb ${n.c}`}>{n.k}</span>
            <div>
              <h2>{n.t}</h2>
              <p>{n.d}</p>
            </div>
          </li>
        ))}
      </ul>

      <section className="if-access" aria-labelledby="access-h">
        <p className="if-eyebrow">ACCESS</p>
        <h2 id="access-h" className="if-h2">
          アクセス
        </h2>

        <div className="if-card">
          <h3>無料送迎バス</h3>
          <p className="if-sub">大原駅前バス停留所（フレスタ側）発</p>
          <ol className="if-times">
            {BUS_FROM_STATION.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ol>
          <p className="if-sub">{VENUE.name}発</p>
          <ol className="if-times">
            {BUS_FROM_SCHOOL.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ol>
          <p className="if-note">天候や交通状況により、時間が前後する場合があります。</p>
        </div>

        <div className="if-card">
          <h3>電車・路線バス</h3>
          <p>
            アストラムライン「大原駅」から、フォーブルバス「飯室行き」「戸山行き」、または広電バス「くすの木台行き」に乗り、3 つ目の「下大下」バス停で下車（約 6 分）。
          </p>
          <p>「下大下」から沼田校舎の正門まで徒歩 5 分、正門から知育館まで坂道を徒歩 10 分です。</p>
        </div>

        <div className="if-card">
          <h3>お車</h3>
          <p>アストラムライン大原駅の交差点を山側へ（県道 38 号・久地通り）。約 3 km 先の交差点を左に曲がると、沼田校舎の正門があります。</p>
          <p>
            <strong>正門から坂道を上る途中に駐車場があります。</strong>
          </p>
        </div>

        <dl className="if-addr">
          <dt>会場</dt>
          <dd>{VENUE.name}</dd>
          <dt>住所</dt>
          <dd>
            〒{VENUE.postal} {VENUE.address}
          </dd>
          <dt>お問い合わせ</dt>
          <dd>
            {EVENT.organizer}
            <br />
            <a href={`tel:${EVENT.tel.replace(/-/g, "")}`}>{EVENT.tel}</a>
          </dd>
        </dl>
        <AccessMap />
        <p className="if-sns">
          お帰りの前に、<a href="/survey">アンケート</a>へのご協力をお願いします。
        </p>
        <p className="if-sns">
          準備の様子や企画の詳細は、学校の{" "}
          <a href={EVENT.instagram} target="_blank" rel="noopener noreferrer">
            Instagram
          </a>{" "}
          にも載っています。
        </p>
      </section>
    </div>
  );
}
