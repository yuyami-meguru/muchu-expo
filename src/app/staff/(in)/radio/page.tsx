import type { Metadata } from "next";
import Link from "next/link";
import { Banner } from "@/components/ui/banner";
import { PageHeader } from "@/components/ui/card";
import { phaseOf } from "@/lib/ops";
import { RADIO_SHOP } from "@/lib/radio";
import { loadRadioMsgs } from "@/lib/radio-server";
import { getShop, storeReady } from "@/lib/store";
import { adminOnly } from "../_components/admin-only";
import { loadAdminOps, serverNow } from "../_components/staff-settings";
import { everyText } from "../ops-result";
import { RadioAdmin } from "./radio-admin";

export const metadata: Metadata = { title: "校内ラジオ" };
export const dynamic = "force-dynamic";

/** 校内ラジオ（実行委員だけ）：ON AIR・いまの内容・番組表・メッセージ */
export default async function StaffRadioPage() {
  await adminOnly("/staff/radio");
  // ラジオの状態と表示の時期は、上の帯（枠）と同じ 1 回の読み込み（loadAdminOps）
  const [ops, { messages, readIds }, shop] = await Promise.all([loadAdminOps(), loadRadioMsgs(), getShop(RADIO_SHOP)]);
  const phase = phaseOf(serverNow(), ops.phase);
  return (
    <div className="st-page st-stack">
      <PageHeader title="校内ラジオ" sub={`［放送を始める］を押すと、お客さんの画面に「放送中」が出ます（当日は 20 秒ほどで届きます）。届いたメッセージは ${everyText(phase)}に読み直します`} />
      {/* 校内ラジオを隠しているあいだ（ラジオのお店が非表示。radio-shop.ts）は、ここで準備はできるが、お客さんには何も出ない */}
      {!shop ? (
        <Banner tone="warning" title="お客さんの画面に校内ラジオは出ていません">
          お店・出し物に「校内ラジオ」（id：{RADIO_SHOP}）が無いため、ラジオのページ・ホームの入口・「放送中」の札は出ず、メッセージも受け付けません。
        </Banner>
      ) : shop.hidden ? (
        <Banner tone="info" title="いまは、お客さんの画面に校内ラジオを出していません">
          ラジオのページ・ホームの入口・「放送中」の札は出ず、メッセージも受け付けません（ここで番組表などの準備はできます）。出すときは、お店の情報の
          <Link href={`/staff/shops/${RADIO_SHOP}`}>「{shop.name}」</Link>で［お客さんの画面に出す］を押してください。
        </Banner>
      ) : null}
      <RadioAdmin state={ops.radio} messages={messages} readIds={readIds} ready={storeReady()} phase={phase} />
    </div>
  );
}
