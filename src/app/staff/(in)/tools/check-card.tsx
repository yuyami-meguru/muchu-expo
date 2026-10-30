"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/field";
import { CHECK_ITEMS } from "@/lib/ops";
import { clock, send } from "../../_lib/client";

const WHEN = ["前日まで", "当日の朝", "終わったら"] as const;
const DAY = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric" });

/**
 * 当日のチェックリスト。押すとすぐ保存し、実行委員みんなで同じ印を見る（ページは 30 秒ごとに読み直す）。
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
    setErr(null);
    setBusy((b) => ({ ...b, [id]: true }));
    setOver((o) => ({ ...o, [id]: on ? Date.now() : null }));
    const r = await send("/api/staff/check", "PUT", { id, done: on });
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
      setErr({ id, text: r.error });
      return;
    }
    router.refresh();
  }

  return (
    <Card title="当日のチェックリスト" aside={`済み ${done}/${CHECK_ITEMS.length}`}>
      <p className="st-muted">押すとすぐ保存します。実行委員みんなで同じ印を見ます（30 秒ごとに読み直します）。</p>
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
                  disabled={!ready || !!busy[c.id]}
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
