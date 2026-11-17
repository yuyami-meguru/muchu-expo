import type { Metadata } from "next";
import { Sprite } from "@/components/pixel/sprites";
import { RADIO_SHOP, radioLive } from "@/lib/radio";
import { loadRadio } from "@/lib/radio-server";
import { loadAll } from "@/lib/store";
import PublicNotFound from "../not-found";
import { MessageForm } from "./message-form";
import { RadioNow } from "./radio-now";
import "./radio.css";

const NOT_FOUND_META: Metadata = { title: "ページが見つかりません", robots: { index: false, follow: false } };

/** 校内ラジオのお店（お店・出し物の一覧にもある。id は radio）。非表示なら undefined */
const radioShop = async () => (await loadAll()).shops.find((s) => s.id === RADIO_SHOP && !s.hidden);

export async function generateMetadata(): Promise<Metadata> {
  try {
    return (await radioShop()) ? { title: "校内ラジオ" } : NOT_FOUND_META;
  } catch {
    return { title: "校内ラジオ" };
  }
}

/**
 * 校内ラジオ：いま放送中か・番組表・ラジオへのメッセージ。
 * 番組表がまだ空のときは、ラジオのお店の「当日の流れ」を出す（タイムテーブル・お店のページと食いちがわないように）。
 * 校内ラジオを隠しているあいだ（ラジオのお店が非表示。radio-shop.ts）は「ページが見つかりません」
 */
export default async function RadioPage() {
  const [radio, shop] = await Promise.all([loadRadio(), radioShop()]);
  if (!shop) return <PublicNotFound />;
  const program = radio.program.length ? radio.program : (shop.schedule ?? []);
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
