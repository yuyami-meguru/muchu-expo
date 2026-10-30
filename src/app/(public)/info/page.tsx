import type { Metadata } from "next";
import Link from "next/link";
import { Fragment } from "react";
import { AccessMap } from "@/components/access/map-buttons";
import { Icon } from "@/components/icons";
import { loadAll } from "@/lib/store";
import { areaName, areaOf, PLACE_KINDS, placeKindOf, type Area, type Place, type PlaceKind } from "@/lib/types";
import { EVENT, VENUE } from "@/lib/venue";
import { ByPhase } from "../_components/in-phase";
import { IfSurveyOpen } from "../_components/survey-entry";
import { BUS_FROM_SCHOOL, BUS_FROM_STATION } from "./bus";
import { BusTimes } from "./bus-times";
import { InfoOrder } from "./info-order";
import "./info.css";

export const metadata: Metadata = { title: "ご来場の方へ" };

// 行き方・送迎バスの時刻は、学校が出したパンフレット（2026-10）と同じ
const NOTES = [
  { k: "坂", t: "正門から会場（知育館）まで坂道を約 10 分", d: "歩きやすい靴でお越しください。お車の方は、坂の途中の駐車場をご利用いただけます。", c: "tone-brown" },
  { k: "音", t: "大きな音がする場所があります", d: "演奏や校内放送があります。音に敏感な方は、耳当て（イヤーマフ）などをお持ちください。", c: "tone-blue" },
  { k: "子", t: "小さなお子さまは保護者の方と一緒に", d: "射的では輪ゴムを使います。人に向けないよう、そばで見ていてください。", c: "" },
  { k: "火", t: "火を使うお店があります", d: "焼き芋や焼きそばなど、屋外で火や鉄板を使います。お店のまわりではお気をつけください。", c: "tone-red" },
  { k: "食", t: "食物アレルギーについて", d: "使っている材料は、お店の生徒におたずねください。", c: "tone-green" },
];

/** 困ったときに案内する設備のピン（実行委員が「地図のピン」で置いたもの）の順 */
const HELP_KINDS: PlaceKind[] = ["info", "aid", "toilet"];
const KIND_LABEL = Object.fromEntries(PLACE_KINDS.map((k) => [k.value, k.label])) as Record<PlaceKind, string>;

/**
 * 困ったときの 1 行の字：種類（「トイレ」）と、どこか（「知育館 2階」）。
 * ピンの名前が種類と同じなら（「トイレ」）、どこかは階の名前だけにする（「トイレ 知育館 2階・トイレ」と重ねない）
 */
function helpLabel(p: Place, areas: Area[]) {
  const kind = KIND_LABEL[placeKindOf(p)];
  const area = areas.find((a) => a.id === areaOf(p));
  const floor = area ? areaName(area) : "外";
  return { kind, where: p.name === kind ? floor : `${floor}・${p.name}` };
}

/** 空白で区切った言葉ごとに、まとめて折り返す（「通信制｜課程」のように言葉の途中で切れないように。長すぎる言葉は中で折る） */
function Words({ text }: { text: string }) {
  return text.split(" ").map((w, i) => (
    <Fragment key={i}>
      {i > 0 && " "}
      <span className="keep">{w}</span>
    </Fragment>
  ));
}

/** 住所を区切りで分ける（「広島市安佐南区」「伴北6丁目4104-2」。区切りの中では折り返さない） */
const ADDRESS = VENUE.address.match(/^(.+?[区町村])(.+)$/)?.slice(1) ?? [VENUE.address];

export default async function InfoPage() {
  // 地図のピンが読めなくても、ご案内は出す（困ったときの「マップで見る」だけ出ない）
  let help: Place[] = [];
  let areas: Area[] = [];
  try {
    const data = await loadAll();
    areas = data.areas;
    help = HELP_KINDS.flatMap((k) => data.places.filter((p) => placeKindOf(p) === k));
  } catch (e) {
    console.error("地図のピンを読めませんでした", e);
  }

  const access = (
    <section className="if-access" id="access" aria-labelledby="access-h">
      <p className="if-eyebrow" aria-hidden="true">
        ACCESS
      </p>
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
        <dd>
          <Words text={VENUE.name} />
        </dd>
        <dt>住所</dt>
        <dd>
          <span className="nowrap">〒{VENUE.postal}</span>{" "}
          {ADDRESS.map((a) => (
            <span key={a} className="keep">
              {a}
            </span>
          ))}
        </dd>
        <dt>お問い合わせ</dt>
        <dd>
          <Words text={EVENT.organizer} />
          <br />
          <a className="if-tel" href={`tel:${EVENT.tel.replace(/-/g, "")}`}>
            <Icon name="電話" size={18} />
            {EVENT.tel}
          </a>
        </dd>
      </dl>
      <AccessMap />
    </section>
  );

  const helpSection = (
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
            {help.map((p) => {
              const { kind, where } = helpLabel(p, areas);
              return (
                <li key={p.id}>
                  <Link href={`/map?place=${p.id}`} className="if-maplink">
                    <span className="if-maplink-k">{kind}</span>
                    <span className="if-maplink-n">{where}</span>
                    <span className="if-maplink-go">
                      <Icon name="地図" size={16} />
                      マップで見る
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );

  const notes = (
    <section className="if-before" id="before" aria-labelledby="notes-h">
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
  );

  return (
    <div className="if-wrap">
      <header className="if-head">
        <p className="if-eyebrow" aria-hidden="true">
          INFORMATION
        </p>
        <h1 className="if-h1">ご来場の方へ</h1>
        <p className="if-when">
          <strong className="keep">{EVENT.date}</strong> <span className="nowrap">{EVENT.hours}</span>
          <br />
          {VENUE.name}
        </p>
        <nav className="if-jump" aria-label="このページの中">
          <a href="#bus">送迎バスの時刻</a>
          <a href="#access">行き方</a>
          <a href="#help">困ったときは</a>
          <a href="#before">ご来場の前に</a>
        </nav>
      </header>

      <InfoOrder access={access} help={helpSection} notes={notes} />

      <ul className="if-more">
        <ByPhase
          day={
            <IfSurveyOpen>
              <li>
                <Link href="/survey">
                  お帰りの前に、アンケートへのご協力をお願いします<span aria-hidden="true"> ▶</span>
                </Link>
              </li>
            </IfSurveyOpen>
          }
          after={
            <IfSurveyOpen>
              <li>
                <Link href="/survey">
                  アンケートへのご協力をお願いします<span aria-hidden="true"> ▶</span>
                </Link>
              </li>
            </IfSurveyOpen>
          }
        />
        <li>
          <a href={EVENT.instagram} target="_blank" rel="noopener noreferrer">
            準備の様子や出し物のくわしいことは、学校の Instagram にも載っています（別の画面で開きます）
          </a>
        </li>
      </ul>
    </div>
  );
}
