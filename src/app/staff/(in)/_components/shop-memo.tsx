"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { Memo } from "@/lib/ops";
import { clock, send } from "../../_lib/client";
import { failText } from "./shop-result";

/**
 * 実行委員からの連絡（全部のお店へ。お客さんには見えない）。黄色いカードで出して［見ました］を押してもらう。
 * まだ見ていないあいだは、枠を太くして「まだ見ていません」と出す。
 */
export function ShopMemo({ memo, acked }: { memo: Memo | null; acked: boolean }) {
  // この画面で［見ました］を押した連絡の id（「いまの様子」に入るまでのあいだも「✓ 見ました」にする）
  const [seen, setSeen] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  if (!memo) return null;
  const done = acked || seen === memo.id;

  async function ack(id: string) {
    setPending(true);
    setError("");
    const r = await send("/api/staff/memo/ack", "POST", { id });
    setPending(false);
    if (!r.ok) return setError(failText("「見ました」を送れませんでした", r.error));
    setSeen(id);
  }

  return (
    <section className={done ? "sh-memo" : "sh-memo sh-memo--new"} aria-labelledby="sh-memo-h">
      <p className="sh-memo-head">
        <strong id="sh-memo-h">実行委員から</strong>
        <time dateTime={new Date(memo.at).toISOString()}>{clock(memo.at)}</time>
        {!done && <span className="sh-memo-badge">まだ見ていません</span>}
      </p>
      <p className="sh-memo-text">{memo.text}</p>
      {done ? (
        <p className="sh-memo-done">✓ 見ました</p>
      ) : (
        <Button variant="primary" pending={pending} onClick={() => ack(memo.id)}>
          見ました
        </Button>
      )}
      {error && (
        <p className="st-err" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
