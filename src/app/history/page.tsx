import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Instrument_Serif, JetBrains_Mono } from "next/font/google";
import { EVENT } from "@/lib/venue";
import { versionLabel } from "@/lib/version";
import { RELEASES, type Release } from "./history-data";
import "./history.css";

/*
 * サイトのあゆみ（/history）。このサイトの更新の記録と、数字・大事にしたこと・使った道具。
 * 2026-11-28 夜 ユーザー「バージョンアップの歴史とか色々万博のものとは全然違うオシャレな感じに仕上げてほしい」。
 * 万博の画面（水色の地・ドット文字・まわりの枠）とは分けたいので、(public) の外に置き、まわりの枠を付けない。
 * 黒い地に明朝の題、数字と版は欧文（Instrument Serif・JetBrains Mono。欧文だけなので軽い）。入口は、いちばん下の帯の版の番号と、ひみつのホーム
 */

const serif = Instrument_Serif({ variable: "--hx-serif", weight: "400", style: ["normal", "italic"], subsets: ["latin"], display: "swap" });
const mono = JetBrains_Mono({ variable: "--hx-mono", weight: ["400", "500"], subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "サイトのあゆみ",
  description: "エンカレ夢中万博のサイトが、最初の 1 枚から当日まで、どう変わってきたかの記録。",
};

export const viewport: Viewport = { themeColor: "#0b0b0d", colorScheme: "dark" };

const WEEK = ["日", "月", "火", "水", "木", "金", "土"];
/** 開催日・次の日には札を付ける */
const DAY_TAG: Record<string, string> = { "2026-11-28": "当日", "2026-11-29": "次の日" };

/** 出した日ごとにまとめる（古い順のまま） */
function byDate(list: Release[]) {
  const map = new Map<string, Release[]>();
  for (const r of list) map.set(r.date, [...(map.get(r.date) ?? []), r]);
  return [...map];
}

/** 小さな直し（v0.0.1 のように、最後の数が 0 でない版） */
const isPatch = (v: string) => !v.endsWith(".0");

export default function HistoryPage() {
  const days = byDate(RELEASES);
  const minor = RELEASES.filter((r) => !isPatch(r.v)).length;
  return (
    <main id="main" className={`hx ${serif.variable} ${mono.variable}`}>
      <header className="hx-top">
        <Link href="/" className="hx-back">
          <span aria-hidden="true">←</span> エンカレ夢中万博
        </Link>
        <span className="hx-top-v">{versionLabel()}</span>
      </header>

      <section className="hx-hero" aria-labelledby="hx-title">
        <p className="hx-kicker">The making of</p>
        <h1 id="hx-title" className="hx-title">
          <span>夢中万博サイトの</span>
          <span>あゆみ</span>
        </h1>
        <p className="hx-range">
          <time dateTime="2026-10-29">2026.10.29</time>
          <span className="hx-range-bar" aria-hidden="true" />
          <time dateTime="2026-11-28">2026.11.28</time>
        </p>
        <p className="hx-lead">
          <span className="keep">1 枚の案内ページから始まって、</span>
          <span className="keep">当日まで。</span>
          <span className="keep">このサイトが、どう変わってきたかの記録です。</span>
        </p>
        <div className="hx-spectrum" aria-hidden="true" />
      </section>

      <section className="hx-nums" aria-label="数字で見る">
        <dl>
          <div>
            <dt>日間（10/29 から 11/28 まで）</dt>
            <dd>31</dd>
          </div>
          <div>
            <dt>回の更新（大きな更新は {minor} 回）</dt>
            <dd>{RELEASES.length}</dd>
          </div>
          <div>
            <dt>のお店・出し物</dt>
            <dd>20</dd>
          </div>
          <div>
            <dt>時間の本番（{EVENT.hours}）</dt>
            <dd>4</dd>
          </div>
        </dl>
      </section>

      <section className="hx-sec" aria-labelledby="hx-log-h">
        <div className="hx-sec-head">
          <p className="hx-sec-en">Changelog</p>
          <h2 id="hx-log-h">更新の記録</h2>
          <p className="hx-sec-note">
            <span className="hx-key hx-key--minor" aria-hidden="true" />
            大きな更新
            <span className="hx-key hx-key--patch" aria-hidden="true" />
            小さな直し
          </p>
        </div>
        <ol className="hx-days">
          {days.map(([date, list]) => {
            const [y, m, d] = date.split("-").map(Number);
            const w = WEEK[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
            const tag = DAY_TAG[date];
            return (
              <li key={date} className={tag ? "hx-day is-tagged" : "hx-day"}>
                <p className="hx-date">
                  <time dateTime={date}>
                    <span className="hx-md">
                      {m}.{String(d).padStart(2, "0")}
                    </span>
                    <span className="hx-w">{w}</span>
                  </time>
                  {tag && <span className="hx-tag">{tag}</span>}
                </p>
                <ul className="hx-rels">
                  {list.map((r) => (
                    <li key={r.v} className={isPatch(r.v) ? "hx-rel is-patch" : "hx-rel"}>
                      <span className="hx-v">{`v${r.v}`}</span>
                      <span className="hx-t">{r.text}</span>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="hx-sec" aria-labelledby="hx-val-h">
        <div className="hx-sec-head">
          <p className="hx-sec-en">Principles</p>
          <h2 id="hx-val-h">大事にしたこと</h2>
        </div>
        <ol className="hx-cards">
          <li>
            <span className="hx-no">01</span>
            <h3>パンフレットと同じ見た目</h3>
            <p>水色の地と、緑のドット文字。学校のパンフレットの表紙から。</p>
          </li>
          <li>
            <span className="hx-no">02</span>
            <h3>当日の「いま」を、すぐに</h3>
            <p>売り切れ・営業中・お知らせは、お店の人が押すと、みんなの画面に出る。</p>
          </li>
          <li>
            <span className="hx-no">03</span>
            <h3>紙とつながる</h3>
            <p>パンフレットの QR から、地図とアンケートへ。お店の人は、自分のお店の QR から書きこめる。</p>
          </li>
          <li>
            <span className="hx-no">04</span>
            <h3>だれでも読める</h3>
            <p>文字を大きくするボタン、暗い画面、小さいスマホでも。</p>
          </li>
        </ol>
      </section>

      <section className="hx-sec hx-stack" aria-labelledby="hx-stack-h">
        <div className="hx-sec-head">
          <p className="hx-sec-en">Built with</p>
          <h2 id="hx-stack-h">使った道具</h2>
        </div>
        <ul>
          <li>Next.js</li>
          <li>React</li>
          <li>TypeScript</li>
          <li>Vercel</li>
          <li>Upstash Redis</li>
          <li>GitHub Pages</li>
        </ul>
      </section>

      <footer className="hx-foot">
        <p className="hx-thanks">Thank you.</p>
        <p className="hx-thanks-ja">ありがとうございました</p>
        <dl className="hx-credits">
          <div>
            <dt>主催</dt>
            <dd>
              <span className="keep">{EVENT.organizer}</span>
              <span className="keep">エンカレ夢中万博 実行委員会</span>
            </dd>
          </div>
          <div>
            <dt>サイト制作</dt>
            <dd>
              <a href="https://www.averix.jp/" target="_blank" rel="noopener noreferrer">
                AVERIX<span className="sr-only">（別の画面で開きます）</span>
              </a>
            </dd>
          </div>
        </dl>
        <p className="hx-foot-nav">
          <Link href="/">ホームへもどる</Link>
        </p>
        <p className="hx-foot-v">{versionLabel()}</p>
      </footer>
    </main>
  );
}
