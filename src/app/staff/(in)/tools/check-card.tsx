"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/field";
import { CHECK_ITEMS } from "@/lib/ops";
import { clock, send } from "../../_lib/client";
import { noteAuth } from "../_components/session-signal";
import { nowMs } from "../ops-live";
import { failMsg } from "../ops-result";

const WHEN = ["前日まで", "当日の朝", "終わったら"] as const;
const DAY = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric" });

/**
 * 当日のチェックリスト。押すとすぐ保存し、実行委員みんなで同じ印を見る（ページは 60 秒ごとと、画面に戻ったときに読み直す）。
 * 印を付けた時刻も出す。
 */
export function CheckCard({ ready, checks }: { ready: boolean; checks: Record<string, string> }) {
  const router = useRouter();
  /** 自分が押した印（読み直しが届くまで出す）。項目 id → 印の時刻（外したら null） */
  const [over, setOver] = useState<Record<string, number | null>>({});
  const [busy, setBusy] = useState<Record<string, true>>({});
  const [err, setErr] = useState<{ id: string; text: string } | null>(null);
  const [seen, setSeen] = useState(checks);
  if (seen !== checks) {
    // 読み直した印が届いたら、それを使う（送っている途中の項目だけは自分の印のまま）
    setSeen(checks);
    setOver((o) => Object.fromEntries(Object.entries(o).filter(([id]) => busy[id])));
  }
  const mark = (id: string): number | null => (id in over ? over[id] : Number(checks[id]) || null);
  const done = CHECK_ITEMS.filter((c) => mark(c.id)).length;

  async function toggle(id: string, on: boolean) {
    // 送っているあいだは何もしない（チェックは disabled にせず「押せない」印だけ。キーボードで選んでいた所が消えないように）
    if (busy[id]) return;
    setErr(null);
    setBusy((b) => ({ ...b, [id]: true }));
    setOver((o) => ({ ...o, [id]: on ? nowMs() : null }));
    const r = noteAuth(await send("/api/staff/check", "PUT", { id, done: on }));
    setBusy((b) => {
      const next = { ...b };
      delete next[id];
      return next;
    });
    if (!r.ok) {
      setOver((o) => {
        const next = { ...o };
        delete next[id];
        return next;
      });
      setErr({ id, text: failMsg(on ? "印を付けることが" : "印を外すことが", r, "少しして、この画面が読み直されたら確かめてください") });
      return;
    }
    router.refresh();
  }

  return (
    <Card title="当日のチェックリスト" aside={`済み ${done}/${CHECK_ITEMS.length}`} id="checks">
      <p className="st-muted">押すとすぐ保存します。実行委員みんなで同じ印を見ます（1 分ごとと、この画面に戻ったときに読み直します）。</p>
      {WHEN.map((w) => (
        <fieldset key={w} className="st-checks">
          <legend>{w}</legend>
          {CHECK_ITEMS.filter((c) => c.when === w).map((c) => {
            const at = mark(c.id);
            return (
              <div key={c.id}>
                <Checkbox
                  label={c.text}
                  hint={at ? `${DAY.format(at)} ${clock(at)} に印` : undefined}
                  checked={!!at}
                  disabled={!ready}
                  aria-disabled={!!busy[c.id] || undefined}
                  onChange={(e) => toggle(c.id, e.target.checked)}
                />
                {err?.id === c.id && (
                  <p className="ops-result ops-result--ng" role="alert">
                    {err.text}
                  </p>
                )}
              </div>
            );
          })}
        </fieldset>
      ))}
    </Card>
  );
}
