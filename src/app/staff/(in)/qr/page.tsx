import type { Metadata } from "next";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { PageHeader } from "@/components/ui/card";
import { loadAll, shopKey } from "@/lib/store";
import { DEPTS } from "@/lib/types";
import { adminOnly } from "../_components/admin-only";
import { PrintButton, RotateKeyButton } from "./qr-tools";

export const metadata: Metadata = { title: "お店の QR" };
export const dynamic = "force-dynamic";

/** お店ごとの編集用 QR を印刷する。かぎは # のうしろに入れる（サーバーの記録に残らない） */
export default async function StaffQrPage() {
  await adminOnly();
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3470";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  const origin = `${proto}://${host}`;
  const { shops } = await loadAll({ fresh: true });
  const cards = await Promise.all(
    shops.map(async (s) => {
      const key = await shopKey(s.id);
      const svg = key ? await QRCode.toString(`${origin}/join#s=${encodeURIComponent(s.id)}&k=${encodeURIComponent(key)}`, { type: "svg", margin: 1, errorCorrectionLevel: "M" }) : null;
      return { shop: s, svg };
    }),
  );
  return (
    <div className="st-page st-page--wide st-stack">
      <PageHeader title="お店の QR" sub="お店ごとに印刷して、そのお店の人だけに渡してください。読み取ると、そのお店の売り切れを変えられるようになります" actions={<PrintButton />} />
      <div className="st-qrs">
        {cards.map(({ shop, svg }) => (
          <article key={shop.id} className={`st-qr d-${shop.dept}`}>
            <p className="st-qr-dept">{DEPTS[shop.dept].name}</p>
            <h2 className="st-qr-name">{shop.name}</h2>
            {svg ? <div className="st-qr-img" role="img" aria-label={`${shop.name}の編集用 QR`} dangerouslySetInnerHTML={{ __html: svg }} /> : <p className="st-err">QR を作れませんでした</p>}
            <p className="st-qr-warn">お店の人だけが使う QR です。お客さんに見せないでください</p>
            <p className="st-qr-how">スマホのカメラで読み取る → 売り切れ・お店の状態を押すだけ</p>
            <div className="st-qr-tools st-noprint">
              <RotateKeyButton shopId={shop.id} shopName={shop.name} />
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
