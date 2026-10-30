"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, buttonClass } from "@/components/ui/button";
import { send } from "../../_lib/client";

/** 受付のオン・オフ、表（CSV）で保存、回答を全部消す */
export function SurveyTools({ open, total, ready }: { open: boolean; total: number; ready: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function toggle() {
    setBusy(true);
    const r = await send("/api/staff/survey", "PUT", { open: !open });
    setBusy(false);
    setMsg(r.ok ? (open ? "受付を止めました" : "受付を始めました") : r.error);
    router.refresh();
  }

  async function clearAll() {
    if (!window.confirm(`回答 ${total} 件を全部消します。元に戻せません。先に「表で保存」しておくと安心です。消しますか？`)) return;
    setBusy(true);
    const r = await send("/api/staff/survey", "DELETE", { confirm: "消す" });
    setBusy(false);
    setMsg(r.ok ? "回答を全部消しました" : r.error);
    router.refresh();
  }

  return (
    <div className="sr-tools">
      <p className="sr-state">
        受付：<strong className={open ? "sr-on" : "sr-off"}>{open ? "受け付けています" : "止めています"}</strong>
      </p>
      <div className="sr-tool-row">
        <Button onClick={toggle} pending={busy} disabled={!ready} variant={open ? "secondary" : "primary"}>
          {open ? "受付を止める" : "受付を始める"}
        </Button>
        {/* ファイルを受け取るので、ページの移動（next/link）ではなくふつうのリンクにする */}
        <a href="/api/staff/survey" download className={buttonClass({ variant: "secondary" })}>
          表（CSV）で保存
        </a>
        <Button onClick={clearAll} variant="danger" icon="消す" disabled={!ready || total === 0 || busy}>
          回答を全部消す
        </Button>
      </div>
      {!ready && <p className="sr-sub">保存先（Upstash）がつながっていないので、変えられません</p>}
      <p className="sr-sub" role="status" aria-live="polite">
        {msg}
      </p>
    </div>
  );
}
