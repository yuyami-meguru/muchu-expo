import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/card";
import { getSession } from "@/lib/auth";
import "./help.css";

export const metadata: Metadata = { title: "使い方" };

/** 従業員側の使い方。お店の人には自分の分だけ、実行委員には両方 */
export default async function StaffHelpPage() {
  const s = await getSession();
  if (!s) redirect("/staff/login");
  const admin = s.role === "admin";
  return (
    <div className="st-page st-stack hp">
      <PageHeader title="使い方" sub="わからないときは、実行委員に声をかけてください" />

      <section className="hp-card">
        <h2>お店の人へ</h2>
        <h3>はじめに（1 回だけ）</h3>
        <ol>
          <li>実行委員からもらった「お店の QR」を、スマホのカメラで読み取る</li>
          <li>自分のお店の画面が開いたら OK。この画面をホーム画面に追加しておくと、当日すぐ開けます</li>
          <li>QR の紙は、なくさないようにお店で 1 枚持っておく（ログインが切れたら、また読み取る）</li>
        </ol>
        <h3>当日</h3>
        <ol>
          <li>お店を開けたら「営業中」、休むときは「休憩中」、閉めたら「終了」を押す</li>
          <li>品物が少なくなったら「残りわずか」、なくなったら「売り切れ」を押す。押すとすぐお客さんの画面に出ます</li>
          <li>「12 時から焼き直します」のようなことは「お店からのお知らせ」に書く</li>
        </ol>
        <h3>当日までに</h3>
        <ul>
          <li>「お店の紹介」で、ひとこと・どんなお店か・お店の思い・当日の流れ・メニューと値段を書けます。書いた内容は実行委員も見られます</li>
          <li>人の名前や顔写真は載せないでください</li>
        </ul>
        <p className="hp-warn">お店の QR は、お店の人だけのものです。お客さんや SNS に見せないでください。見せてしまったら、実行委員に言えば新しくできます。</p>
      </section>

      {admin && (
        <section className="hp-card">
          <h2>実行委員・先生へ</h2>
          <h3>準備（当日まで）</h3>
          <ol>
            <li>「部門」で部門をそろえる（増えたり減ったりしても、あとから変えられます）</li>
            <li>「お店の情報」でお店を足す。足したお店は「非公開」で始まるので、中身を入れたら公開にする</li>
            <li>「地図のピン」で場所を作り、お店の情報で場所を選ぶ</li>
            <li>「お店の QR（編集用）」を印刷して、各お店のリーダーに渡す</li>
            <li>「お客さん用ポスター」を印刷して、お店の前や入口に貼る</li>
            <li>「変更の記録」で、お店の人が書いた内容を確認する</li>
          </ol>
          <h3>当日の朝</h3>
          <ol>
            <li>「当日の道具」で、ためしに押した売り切れ・状態をまとめて元に戻す</li>
            <li>「当日の道具」で「データの控え」を保存しておく（何かあったら戻せます）</li>
            <li>10:00 に、お店に「営業中」を押してもらう（「当日の道具」からまとめて営業中にもできます）</li>
          </ol>
          <h3>当日</h3>
          <ul>
            <li>ステージの時間変更や落とし物などは「お知らせ」に書く。トップのいちばん上に出ます（大事なものは「上に固定」）</li>
            <li>「いまの様子」で全部のお店の売り切れを見られます。札を押すと変えられます</li>
          </ul>
          <p className="hp-warn">合言葉を知っている人は、全部のお店を書き換えられます。合言葉は LINE のグループに書かず、口頭か紙で伝えてください。</p>
        </section>
      )}
    </div>
  );
}
