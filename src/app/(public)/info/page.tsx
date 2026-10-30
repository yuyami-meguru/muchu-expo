import type { Metadata } from "next";
import Link from "next/link";
import { AccessMap } from "@/components/access/map-buttons";
import { Icon } from "@/components/icons";
import { loadAll } from "@/lib/store";
import { PLACE_KINDS, placeKindOf, type Place, type PlaceKind } from "@/lib/types";
import { EVENT, VENUE } from "@/lib/venue";
import { IfSurveyOpen } from "../_components/survey-entry";
import { BUS_FROM_SCHOOL, BUS_FROM_STATION } from "./bus";
import { BusTimes } from "./bus-times";
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

/** 困ったときに案内する設備のピン（実行委員が「地図のピン」で置いたもの）の順 */
const HELP_KINDS: PlaceKind[] = ["info", "aid", "toilet"];
const KIND_LABEL = Object.fromEntries(PLACE_KINDS.map((k) => [k.value, k.label])) as Record<PlaceKind, string>;

export default async function InfoPage() {
  // 地図のピンが読めなくても、ご案内は出す（困ったときの「マップで見る」だけ出ない）
  let help: Place[] = [];
  try {
    const { places } = await loadAll();
    help = HELP_KINDS.flatMap((k) => places.filter((p) => placeKindOf(p) === k));
  } catch (e) {
    console.error("地図のピンを読めませんでした", e);
  }

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

      <section className="if-access" id="access" aria-labelledby="access-h">
        <p className="if-eyebrow">ACCESS</p>
        <h2 id="access-h" className="if-h2">
          アクセス（行き方）
        </h2>

        <div className="if-card" id="bus">
          <h3>無料送迎バス</h3>
          <p className="if-sub">行き：大原駅前バス停留所（フレスタ側）発</p>
          <BusTimes times={BUS_FROM_STATION} label="大原駅前バス停留所発の時刻" />
          <p className="if-sub">帰り：{VENUE.name}発</p>
          <BusTimes times={BUS_FROM_SCHOOL} label={`${VENUE.name}発の時刻`} showNext />
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
            <a className="if-tel" href={`tel:${EVENT.tel.replace(/-/g, "")}`}>
              <Icon name="電話" size={18} />
              {EVENT.tel}
            </a>
          </dd>
        </dl>
        <AccessMap />
      </section>

      <section className="if-help" id="help" aria-labelledby="help-h">
        <h2 id="help-h" className="if-h2">
          困ったときは
        </h2>
        <div className="if-card">
          <p>
            迷子・落とし物・けが・体調が悪いときは、近くの生徒・先生（係）に声をかけてください。<strong>受付（本部）</strong>でもお受けします。
          </p>
          {help.length > 0 && (
            <ul className="if-help-links">
              {help.map((p) => (
                <li key={p.id}>
                  <Link href={`/map?place=${p.id}`} className="if-maplink">
                    <span className="if-maplink-k">{KIND_LABEL[placeKindOf(p)]}</span>
                    <span className="if-maplink-n">{p.name}</span>
                    <span className="if-maplink-go">
                      <Icon name="地図" size={16} />
                      マップで見る
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="if-before" aria-labelledby="notes-h">
        <h2 id="notes-h" className="if-h2">
          ご来場の前に
        </h2>
        <ul className="if-notes">
          {NOTES.map((n) => (
            <li key={n.k}>
              <span className={`if-kb ${n.c}`} aria-hidden="true">
                {n.k}
              </span>
              <div>
                <h3>{n.t}</h3>
                <p>{n.d}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <IfSurveyOpen>
        <p className="if-sns">
          お帰りの前に、<Link href="/survey">アンケート</Link>へのご協力をお願いします。
        </p>
      </IfSurveyOpen>
      <p className="if-sns">
        準備の様子や出し物の詳細は、学校の{" "}
        <a href={EVENT.instagram} target="_blank" rel="noopener noreferrer">
          Instagram（別の画面で開きます）
        </a>{" "}
        にも載っています。
      </p>
    </div>
  );
}
