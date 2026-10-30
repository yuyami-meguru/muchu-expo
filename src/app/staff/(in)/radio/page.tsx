import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/card";
import { phaseOf } from "@/lib/ops";
import { loadRadioMsgs } from "@/lib/radio-server";
import { storeReady } from "@/lib/store";
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
  const [ops, { messages, readIds }] = await Promise.all([loadAdminOps(), loadRadioMsgs()]);
  const phase = phaseOf(serverNow(), ops.phase);
  return (
    <div className="st-page st-stack">
      <PageHeader title="校内ラジオ" sub={`［放送を始める］を押すと、お客さんの画面に「放送中」が出ます（当日は 20 秒ほどで届きます）。届いたメッセージは ${everyText(phase)}に読み直します`} />
      <RadioAdmin state={ops.radio} messages={messages} readIds={readIds} ready={storeReady()} phase={phase} />
    </div>
  );
}
