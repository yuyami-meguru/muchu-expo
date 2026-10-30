import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/card";
import { loadRadio, loadRadioMsgs } from "@/lib/radio-server";
import { storeReady } from "@/lib/store";
import { adminOnly } from "../_components/admin-only";
import { RadioAdmin } from "./radio-admin";

export const metadata: Metadata = { title: "校内ラジオ" };
export const dynamic = "force-dynamic";

/** 校内ラジオ（実行委員だけ）：ON AIR・いまの内容・番組表・メッセージ */
export default async function StaffRadioPage() {
  await adminOnly();
  const [state, { messages, readIds }] = await Promise.all([loadRadio(), loadRadioMsgs()]);
  return (
    <div className="st-page st-stack">
      <PageHeader title="校内ラジオ" sub="［放送を始める］を押すと、お客さんの画面に「放送中」が出ます（15 秒ほどで届きます）。メッセージは 15 秒ごとに読み直します" />
      <RadioAdmin state={state} messages={messages} readIds={readIds} ready={storeReady()} />
    </div>
  );
}
