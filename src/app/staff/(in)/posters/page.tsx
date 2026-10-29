import type { Metadata } from "next";
import type { CSSProperties } from "react";
import QRCode from "qrcode";
import { Sprite, type SpriteName } from "@/components/pixel/sprites";
import { Banner } from "@/components/ui/banner";
import { PageHeader } from "@/components/ui/card";
import { SITE_URL } from "@/lib/site";
import { loadAll } from "@/lib/store";
import { deptLookup, type Tone } from "@/lib/types";
import { EVENT, VENUE } from "@/lib/venue";
import { adminOnly } from "../_components/admin-only";
import { PrintButton } from "../qr/qr-tools";
import "./posters.css";

export const metadata: Metadata = { title: "お客さん用ポスター" };
export const dynamic = "force-dynamic";

// 印刷はいつも明るい色で（画面がダークモードでも同じ紙になるように、部門の色をここで決める）
const TONE_HEX: Record<Tone, string> = {
  blue: "#1f4fb0",
  orange: "#c64d0c",
  red: "#b8321f",
  purple: "#6a43a8",
  green: "#2f7a22",
  teal: "#0b7068",
  pink: "#b02a68",
  brown: "#7a5230",
};
const PAIRS: [SpriteName, SpriteName][] = [
  ["controller", "ball"],
  ["camera", "cube"],
  ["guitar", "sneaker"],
  ["skate", "note"],
  ["paint", "controller"],
  ["cube", "skate"],
];

async function qr(url: string) {
  return QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#1f2547", light: "#ffffff" } });
}

/** 店名の長さで文字の大きさを変える（1 行〜2 行に収める） */
function nameSize(name: string) {
  const n = [...name].length;
  return n <= 6 ? "11cqw" : n <= 10 ? "8.4cqw" : n <= 14 ? "6.6cqw" : "5.4cqw";
}

/**
 * 会場に貼る、お客さん用の QR ポスター（実行委員だけ）。A4 縦 1 枚ずつ。
 * いちばん前は会場全体の案内（サイトのトップへ）、そのあとはお店ごと（そのお店のページへ）。
 * お店の人が売り切れを変える「お店の QR」（/staff/qr）とは別物で、こちらはお客さんに見せてよい。
 */
export default async function StaffPostersPage() {
  await adminOnly();
  const { shops, depts, places } = await loadAll({ fresh: true });
  const dept = deptLookup(depts);
  const placeName = Object.fromEntries(places.map((p) => [p.id, p.name]));
  const visible = shops.filter((s) => !s.hidden);
  const hiddenCount = shops.length - visible.length;
  const topQr = await qr(`${SITE_URL}/`);
  const sheets = await Promise.all(
    visible.map(async (s) => ({ shop: s, d: dept(s.dept), svg: await qr(`${SITE_URL}/shops/${encodeURIComponent(s.id)}`) })),
  );
  const host = SITE_URL.replace(/^https?:\/\//, "");

  return (
    <div className="st-page st-stack pst-page">
      <div className="st-noprint st-stack">
        <PageHeader title="お客さん用ポスター" sub="会場に貼る A4 のポスターです。1 枚目は会場全体の案内、2 枚目からはお店ごと" actions={<PrintButton />} />
        <Banner tone="info" title="これは、お客さんに見せてよい QR です">
          読み取ると、そのお店のメニュー・値段・売り切れ・お店の思いが見られます（だれでも見られるページ）。
          お店の人が売り切れを変えるための QR は「お店の QR」の画面にあり、そちらはお客さんに見せないでください。
          {hiddenCount > 0 && ` 非公開のお店（${hiddenCount} 店）のポスターは出していません。`}
        </Banner>
        <p className="st-muted">印刷の設定：用紙 A4・縦、余白なし（または「最小」）、「背景のグラフィック」をオンにすると水色の地も出ます。</p>
      </div>

      <div className="pst-list">
        {/* 1 枚目：会場全体の案内 */}
        <section className="pst-sheet pst-sheet--top" aria-label="会場全体の案内ポスター">
          <Sprite name="controller" size={120} className="pst-sp pst-sp--a" />
          <Sprite name="guitar" size={120} className="pst-sp pst-sp--b" />
          <Sprite name="ball" size={120} className="pst-sp pst-sp--c" />
          <Sprite name="cube" size={120} className="pst-sp pst-sp--d" />
          <p className="pst-org">{EVENT.organizer}</p>
          <div className="pst-main">
            <h2 className="pst-title">
              <span className="pst-title-1">エンカレ</span>
              <span className="pst-title-2">夢中万博</span>
            </h2>
            <p className="pst-date">
              2026.11.28（土） {EVENT.hours}
              <br />
              {VENUE.name}
            </p>
            <div className="pst-qr" dangerouslySetInnerHTML={{ __html: topQr }} role="img" aria-label="サイトのトップの QR" />
            <p className="pst-lead">
              売り切れ・マップ・お店の思いは、
              <br />
              ここから
            </p>
            <p className="pst-sub">スマホのカメラで読み取ってください</p>
            <ul className="pst-depts" aria-label="部門">
              {depts
                .filter((d) => visible.some((s) => s.dept === d.id))
                .map((d) => (
                  <li key={d.id} style={{ background: TONE_HEX[d.color] }}>
                    {d.name}
                  </li>
                ))}
            </ul>
          </div>
          {/* 学校のロゴは札にのせず、パンフの裏面のようにいちばん下に小さく */}
          <div className="pst-foot">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/school-logo.svg" alt="学校法人鶴学園 広島工業大学高等学校［通信制課程］" />
            <p className="pst-url">{host}</p>
          </div>
        </section>

        {/* 2 枚目から：お店ごと */}
        {sheets.map(({ shop, d, svg }, i) => {
          const [a, b] = PAIRS[i % PAIRS.length];
          return (
            <section key={shop.id} className="pst-sheet" style={{ "--c": TONE_HEX[d.color] } as CSSProperties} aria-label={`${shop.name}のポスター`}>
              <Sprite name={a} size={120} className="pst-sp pst-sp--a" />
              <Sprite name={b} size={120} className="pst-sp pst-sp--c" />
              <p className="pst-brand">エンカレ夢中万博　2026.11.28（土）{EVENT.hours}</p>
              <div className="pst-main">
                <p className="pst-dept">{d.name}</p>
                <h2 className="pst-name" style={{ fontSize: nameSize(shop.name) }}>
                  {shop.name}
                </h2>
                {shop.catch && <p className="pst-catch">{shop.catch}</p>}
                <div className="pst-qr" dangerouslySetInnerHTML={{ __html: svg }} role="img" aria-label={`${shop.name}のページの QR`} />
                <p className="pst-lead">メニュー・値段・売り切れはスマホで</p>
                <p className="pst-sub">読み取ると、このお店のページが開きます（お店の思いも）</p>
                {(shop.placeNote || placeName[shop.placeId]) && <p className="pst-place">場所：{shop.placeNote || placeName[shop.placeId]}</p>}
              </div>
              <p className="pst-url">
                {host}/shops/{shop.id}
              </p>
            </section>
          );
        })}
      </div>
    </div>
  );
}
