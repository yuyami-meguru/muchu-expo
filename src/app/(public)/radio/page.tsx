import type { Metadata } from "next";
import { Sprite } from "@/components/pixel/sprites";
import { radioLive } from "@/lib/radio";
import { loadRadio } from "@/lib/radio-server";
import { MessageForm } from "./message-form";
import { RadioNow } from "./radio-now";
import "./radio.css";

export const metadata: Metadata = { title: "校内ラジオ" };

/** 校内ラジオ：いま放送中か・番組表・ラジオへのメッセージ */
export default async function RadioPage() {
  const radio = await loadRadio();
  return (
    <div className="rd-wrap">
      <header className="rd-head">
        <Sprite name="note" size={44} className="rd-sp" />
        <p className="rd-eyebrow">RADIO</p>
        <h1 className="rd-h1 px-title">校内ラジオ</h1>
        <p className="rd-lead">実行委員が会場全体に放送しています。お店や発表のお知らせ、クイズやゲームも。</p>
      </header>

      <RadioNow initial={radioLive(radio)} />

      <section className="rd-card" aria-labelledby="rd-prog-h">
        <h2 id="rd-prog-h">番組表</h2>
        {radio.program.length ? (
          <ol className="rd-prog">
            {radio.program.map((p, i) => (
              <li key={i}>
                <span className="rd-prog-t">{p.time}</span>
                <span>{p.text}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="rd-empty">
            <span className="tbd">番組表は準備中</span>
          </p>
        )}
        <p className="rd-small">時間は変わることがあります。</p>
      </section>

      <section className="rd-card" aria-labelledby="rd-msg-h">
        <h2 id="rd-msg-h">ラジオへのメッセージ</h2>
        {radio.msgOpen ? (
          <>
            <p className="rd-small">質問・メッセージ・リクエスト・クイズの答えを送れます。放送で読ませてもらうことがあります。</p>
            <MessageForm />
          </>
        ) : (
          <p className="rd-empty">いまはメッセージを受け付けていません。</p>
        )}
      </section>
    </div>
  );
}
