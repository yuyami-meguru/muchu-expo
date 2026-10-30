import type { Metadata } from "next";
import { Sprite } from "@/components/pixel/sprites";
import { radioLive } from "@/lib/radio";
import { loadRadio } from "@/lib/radio-server";
import { loadAll } from "@/lib/store";
import { MessageForm } from "./message-form";
import { RadioNow } from "./radio-now";
import "./radio.css";

export const metadata: Metadata = { title: "校内ラジオ" };

/** 校内ラジオのお店（お店・出し物の一覧にもある。id は radio） */
const RADIO_SHOP = "radio";

/**
 * 校内ラジオ：いま放送中か・番組表・ラジオへのメッセージ。
 * 番組表がまだ空のときは、ラジオのお店の「当日の流れ」を出す（タイムテーブル・お店のページと食いちがわないように）
 */
export default async function RadioPage() {
  const radio = await loadRadio();
  let program = radio.program;
  if (!program.length) {
    try {
      const shop = (await loadAll()).shops.find((s) => s.id === RADIO_SHOP && !s.hidden);
      program = shop?.schedule ?? [];
    } catch (e) {
      console.error("ラジオのお店を読めませんでした", e);
    }
  }
  return (
    <div className="rd-wrap">
      <header className="rd-head">
        <Sprite name="note" size={44} className="rd-sp" />
        <p className="rd-eyebrow" aria-hidden="true">
          RADIO
        </p>
        <h1 className="rd-h1 px-title">校内ラジオ</h1>
        <p className="rd-lead">当日は、実行委員が会場全体に向けて放送します。お店や発表のお知らせ、クイズやゲームもあります。</p>
      </header>

      <RadioNow initial={radioLive(radio)} hasProgram={program.length > 0} />

      <section className="rd-card" aria-labelledby="rd-prog-h">
        <h2 id="rd-prog-h">番組表</h2>
        {program.length ? (
          <ol className="rd-prog">
            {program.map((p, i) => (
              <li key={i}>
                <span className="rd-prog-t">{p.time}</span>
                <span>{p.text}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="rd-empty">放送の時間は、決まったらここでお知らせします。</p>
        )}
        <p className="rd-small">時間は変わることがあります。</p>
      </section>

      <section className="rd-card" aria-labelledby="rd-msg-h">
        <h2 id="rd-msg-h">ラジオへのメッセージ</h2>
        {radio.msgOpen ? (
          <>
            <p className="rd-small">質問・メッセージ・リクエスト・クイズの答えを送れます。放送で読ませていただくことがあります。</p>
            <MessageForm />
          </>
        ) : (
          <p className="rd-empty">いまはメッセージを受け付けていません。</p>
        )}
      </section>
    </div>
  );
}
