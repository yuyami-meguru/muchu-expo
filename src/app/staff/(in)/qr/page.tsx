import type { Metadata } from "next";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { Banner } from "@/components/ui/banner";
import { PageHeader } from "@/components/ui/card";
import { SITE_URL } from "@/lib/site";
import { loadAll, readHash, shopKey } from "@/lib/store";
import { deptLookup } from "@/lib/types";
import { adminOnly } from "../_components/admin-only";
import { asOfText, cssString, SHORT_DATE } from "../posters/paper";
import { PrintButton, PrintOneButton, RotateKeyButton } from "./qr-tools";
import "./qr.css";

export const metadata: Metadata = { title: "お店の人に配る QR" };
export const dynamic = "force-dynamic";

/** 本番（Vercel の production）だけ、QR の行き先をサイトの正式なアドレスにする（ポスターと同じ。開いていたアドレスに左右されない。R9-11） */
const PROD = process.env.VERCEL_ENV === "production";

/**
 * お店ごとの編集用 QR（お店の人に配る QR）を印刷する。かぎは # のうしろに入れる（サーバーの記録に残らない）。
 * お客さん向けではないので、紙のいちばん上に「お店の人だけ」の黒い帯を付け、刷った時点も入れる（作り直した QR と前の紙を見分ける）。
 * かぎはまとめて 1 回で読む（お店ごとに読むと、40 店で Upstash を 80 回使っていた）。まだかぎの無いお店だけ、ここで作る。
 */
export default async function StaffQrPage() {
  await adminOnly("/staff/qr");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3470";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  const origin = PROD ? SITE_URL : `${proto}://${host}`;
  const shown = origin.replace(/^https?:\/\//, "");
  const [{ shops, depts }, keys] = await Promise.all([loadAll({ fresh: true }), readHash("key")]);
  const dept = deptLookup(depts);
  const asOf = asOfText();
  const cards = await Promise.all(
    shops.map(async (s) => {
      const key = keys[s.id] || (await shopKey(s.id));
      const svg = key ? await QRCode.toString(`${origin}/join#s=${encodeURIComponent(s.id)}&k=${encodeURIComponent(key)}`, { type: "svg", margin: 2, errorCorrectionLevel: "M" }) : null;
      return { shop: s, svg };
    }),
  );
  // 印刷した紙の欄外：上に「お店の人だけ」、下に時点とページ番号（ブラウザが自分で刷るアドレス・日時の代わり）
  const font = "font-family: var(--font, sans-serif); font-size: 8.5pt; color: #241b14;";
  const pageCss =
    `@media print { @page pqr { size: A4 portrait; margin: 12mm; ` +
    `@top-left { content: ${cssString("エンカレ夢中万博　お店の人に配る QR（お店の人だけ・会場に貼らない）")}; ${font} } ` +
    `@bottom-left { content: ${cssString(asOf)}; ${font} } ` +
    `@bottom-right { content: counter(page) " / " counter(pages); ${font} } } .pq-page { page: pqr; } }`;

  return (
    <div className="st-page st-page--wide st-stack pq-page">
      <style dangerouslySetInnerHTML={{ __html: pageCss }} />
      <PageHeader
        title="お店の人に配る QR"
        sub="お店ごとに印刷して、そのお店の人だけに渡してください。読み取ると、そのお店の紹介・メニュー・売り切れを変えられるようになります。会場には貼らないでください（会場に貼るのは「会場に貼るポスター」）"
        actions={<PrintButton label="全部印刷する" />}
      />
      {!PROD && (
        <Banner tone="warning" title={`これは本番のサイトではありません（${shown}）`} className="st-noprint">
          ここで刷った QR は、このサーバーでしか使えません。お店の人に配る紙は、本番のサイト（{SITE_URL.replace(/^https?:\/\//, "")}）のこの画面で刷ってください。
        </Banner>
      )}
      {cards.length > 6 && (
        <details className="pq-jump st-noprint">
          <summary>お店から選ぶ（{cards.length} 件）</summary>
          <ul>
            {cards.map(({ shop }) => (
              <li key={shop.id}>
                <a href={`#qr-${shop.id}`}>{shop.name}</a>
              </li>
            ))}
          </ul>
        </details>
      )}
      <div className="st-qrs">
        {cards.map(({ shop, svg }) => (
          <article key={shop.id} id={`qr-${shop.id}`} data-print-unit className={`st-qr pq-card tone-${dept(shop.dept).color}`}>
            <p className="pq-band">
              <strong>お店の人だけ</strong>
              <span>会場に貼らない</span>
            </p>
            <p className="st-qr-dept">{dept(shop.dept).name}</p>
            <h2 className="st-qr-name">{shop.name}</h2>
            {svg ? (
              <div className="st-qr-img pq-img" role="img" aria-label={`${shop.name}のお店の人の QR`} dangerouslySetInnerHTML={{ __html: svg }} />
            ) : (
              <p className="st-err">QR を作れませんでした。画面を読み込み直してください</p>
            )}
            <p className="pq-host">読み取ると、{shown} の「{shop.name}」の画面が開きます</p>
            <ul className="pq-how">
              <li>
                <b>{SHORT_DATE} より前</b>この QR で入って、お店の紹介・メニュー・値段を書いてください（いつまでに書くかは、実行委員から）
              </li>
              <li>
                <b>当日</b>売り切れ・お店の状態を押すだけで変えられます
              </li>
              <li>読み取りは、スマホのカメラで（LINE の読み取りではなく）</li>
              <li>この QR があれば、だれでもこのお店を変えられます。なくしたら、すぐ実行委員へ（作り直します）</li>
            </ul>
            <p className="pq-asof">{asOf}の QR（作り直すと、前の紙は使えません）</p>
            <div className="st-qr-tools st-noprint">
              <PrintOneButton target={`qr-${shop.id}`} />
              <RotateKeyButton shopId={shop.id} shopName={shop.name} />
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
