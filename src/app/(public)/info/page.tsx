import type { Metadata } from "next";
import "./info.css";

export const metadata: Metadata = { title: "ご来場の方へ" };

const NOTES = [
  { k: "音", t: "大きな音がする場所があります", d: "バンド演奏や校内放送があります。音に敏感な方は、イヤーマフなどをお持ちください。", c: "d-taiken" },
  { k: "子", t: "小さなお子さまは保護者の方と一緒に", d: "射的では輪ゴムを使います。的に向けて、人には向けないでください。", c: "" },
  { k: "火", t: "火を使うお店があります", d: "焼き芋や焼きそばなど、屋外で火や鉄板を使います。お店のまわりではお気をつけください。", c: "d-chiiki" },
  { k: "食", t: "食物アレルギーについて", d: "使っている材料は、お店の生徒におたずねください。", c: "d-unei" },
];

const MAP_URL = "https://www.google.com/maps/search/?api=1&query=%E5%BA%83%E5%B3%B6%E5%B7%A5%E6%A5%AD%E5%A4%A7%E5%AD%A6%E9%AB%98%E7%AD%89%E5%AD%A6%E6%A0%A1+%E6%B2%BC%E7%94%B0%E6%A0%A1%E8%88%8E";

export default function InfoPage() {
  return (
    <div className="if-wrap">
      <header className="if-head">
        <p className="if-eyebrow">INFORMATION</p>
        <h1 className="if-h1">ご来場の方へ</h1>
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
        <li>
          <span className="if-kb">車</span>
          <div>
            <h2>お車でお越しの方</h2>
            <p>
              <span className="tbd">駐車場については準備中</span>
            </p>
          </div>
        </li>
      </ul>

      <section className="if-access" aria-labelledby="access-h">
        <p className="if-eyebrow">ACCESS</p>
        <h2 id="access-h" className="if-h2">
          アクセス
        </h2>
        <dl className="if-addr">
          <dt>日時</dt>
          <dd>2026年11月28日（土）11:00〜14:00</dd>
          <dt>会場</dt>
          <dd>広島工業大学高等学校 沼田校舎</dd>
          <dt>住所</dt>
          <dd>広島市安佐南区伴北六丁目</dd>
          <dt>バス・電車</dt>
          <dd>
            <span className="tbd">準備中</span>
          </dd>
        </dl>
        <a className="if-btn" href={MAP_URL} target="_blank" rel="noopener noreferrer">
          地図アプリで開く →
        </a>
      </section>
    </div>
  );
}
