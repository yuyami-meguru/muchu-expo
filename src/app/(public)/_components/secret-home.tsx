import Link from "next/link";
import { Sprite } from "@/components/pixel/sprites";
import { CLOSE_AT, DAY_END, OPEN_AT } from "@/lib/ops";
import { EVENT } from "@/lib/venue";
import { Bandanas, SecretTop } from "./secret-parts";

/**
 * ひみつのホーム。開催日の次の日（11/29）の 0:00 から、ホームをこれに替える（page.tsx。ops.ts の SECRET_FROM）。
 * 2026-11-28 夜 ユーザー「翌日開いた人だけが見れる秘密のホームに変更しよう」。
 * 上から：お礼の表紙 → （発表していれば）夢中アワード・（受け付けていれば）アンケート → 白いバンダナ（押すと色が付く）→ あの日のきろく → 当日のページへ。
 * 白いバンダナは共通グッズ。掲示「白いバンダナに、こめた思い」の「同じ白から、それぞれの色へ。」につなげた
 */
export function SecretHome({ now, shopNames, deptCount, awardTitle }: { now: number; shopNames: string[]; deptCount: number; awardTitle: string }) {
  // 次の日（11/29）のうちは「きのうは」、その先は「11 月 28 日は」
  const when = now < DAY_END + 86_400_000 ? "きのうは" : "11 月 28 日は";
  const hours = Math.round((CLOSE_AT - OPEN_AT) / 3_600_000);
  return (
    <>
      <section className="hs-hero" aria-labelledby="hs-title">
        <div className="hm-sprites" aria-hidden="true">
          <Sprite name="trophy" size={110} className="sp sp-controller" />
          <Sprite name="guitar" size={150} className="sp sp-guitar" />
          <Sprite name="crown" size={64} className="sp sp-cube" />
          <Sprite name="ball" size={110} className="sp sp-ball" />
          <Sprite name="note" size={40} className="sp sp-note" />
          <Sprite name="skate" size={150} className="sp sp-skate" />
        </div>
        <div className="hm-wrap hs-hero-in">
          <p className="hs-badge">
            <Sprite name="sparkle" size={20} />
            ひみつのホーム
          </p>
          <h1 id="hs-title" className="px-title hs-title">
            <span className="t1">エンカレ夢中万博</span>
            <span className="t2">ありがとう！</span>
          </h1>
          <p className="hs-when">
            <span aria-hidden="true">2026.11.28</span>
            <span className="sr-only">2026年11月28日</span>
            <span className="hm-dow">
              土<span className="sr-only">曜日</span>
            </span>
            <span className="hs-when-t">ぶじに終わりました</span>
          </p>
          <div className="hs-letter">
            <p className="hs-letter-t">{when}、エンカレ夢中万博に来てくださり、ありがとうございました。</p>
            <p>このページは、終わった次の日から開いた人だけが見られる、ひみつのホームです。</p>
          </div>
        </div>
      </section>

      <SecretTop awardTitle={awardTitle} />

      {/* 白いバンダナ（押すと、それぞれの色に） */}
      <section className="hm-sec hs-band" aria-labelledby="hs-band-h">
        <div className="hm-wrap hs-band-in">
          <h2 id="hs-band-h" className="hm-h2 px-title hs-band-h">
            同じ白から、
            <wbr />
            それぞれの色へ。
          </h2>
          <p>
            <span className="keep">共通グッズの白いバンダナには、</span>
            <span className="keep">「スタートは、みんな同じ白から」</span>
            <span className="keep">という思いをこめました。</span>
          </p>
          <Bandanas />
          {/* 「「夢中」｜は、」と切れないよう、まとまりごとに折る */}
          <p>
            <span className="keep">同じ白から始まった</span>
            <span className="keep">一人ひとりの「夢中」は、</span>
            <span className="keep">どんな色になりましたか？</span>
          </p>
        </div>
      </section>

      {/* あの日のきろく */}
      <section className="hm-sec hm-sec--alt" aria-labelledby="hs-rec-h">
        <div className="hm-wrap">
          <h2 id="hs-rec-h" className="hm-h2 px-title">
            あの日のきろく
          </h2>
          <ul className="hs-stats">
            <li>
              <b>{shopNames.length}</b>
              <span>お店・出し物</span>
            </li>
            <li>
              <b>{deptCount}</b>
              <span>部門</span>
            </li>
            <li>
              <b>{hours}</b>
              <span>
                時間<small>{EVENT.hours}</small>
              </span>
            </li>
          </ul>
        </div>
      </section>

      {/* 流れる帯：あの日のお店・出し物（2 回流れたら止まる。押したり、指・マウスをのせたりしたら止まる） */}
      {shopNames.length > 0 && (
        <div className="hm-marquee" aria-hidden="true">
          <div className="hm-track">
            {[...shopNames, ...shopNames].map((t, i) => (
              <span key={i}>
                {t}
                <b>◆</b>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 当日のページ（そのまま見られる） */}
      <section className="hm-sec hm-sec--alt" aria-labelledby="hs-pages-h">
        <div className="hm-wrap">
          <h2 id="hs-pages-h" className="hm-h2 px-title">
            あの日のページ
          </h2>
          <p className="hm-lead">お店・出し物やマップは、当日のまま見られます。</p>
          <div className="hm-doors hm-doors--3">
            <Link href="/shops" className="hm-door tone-green">
              <Sprite name="cube" size={40} />
              <span className="hm-door-t">お店・出し物</span>
              <span className="hm-door-s">メニュー・当日の流れ・お店の思い</span>
            </Link>
            <Link href="/map" className="hm-door tone-blue">
              <Sprite name="controller" size={44} />
              <span className="hm-door-t">マップ</span>
              <span className="hm-door-s">どこで何をしていたか（外・知育館の各階）</span>
            </Link>
            <a href={EVENT.instagram} target="_blank" rel="noopener noreferrer" className="hm-door tone-purple">
              <Sprite name="camera" size={44} />
              <span className="hm-door-t">Instagram</span>
              <span className="hm-door-s">エンカレッジコースの Instagram（別の画面で開きます）</span>
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
