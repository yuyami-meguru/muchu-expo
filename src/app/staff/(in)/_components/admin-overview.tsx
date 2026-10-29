"use client";

import Link from "next/link";
import { useState } from "react";
import { DEPTS, DEPT_ORDER, STATE_LABEL, STOCK_LABEL, type Shop, type Stock } from "@/lib/types";
import { savedAt, send } from "../../_lib/client";

const NEXT: Record<Stock, Stock> = { on: "few", few: "out", out: "on" };

/** 実行委員の「いまの様子」：部門ごとにお店を並べ、品物の札を押すと残りを順に変える */
export function AdminOverview({ shops: initial }: { shops: Shop[] }) {
  const [shops, setShops] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  async function cycle(shop: Shop, itemId: string) {
    const item = shop.menu.find((m) => m.id === itemId);
    if (!item) return;
    const stock = NEXT[item.stock];
    const before = shops;
    setShops((list) => list.map((s) => (s.id === shop.id ? { ...s, menu: s.menu.map((m) => (m.id === itemId ? { ...m, stock } : m)) } : s)));
    setBusy(`${shop.id}/${itemId}`);
    setError("");
    const r = await send(`/api/staff/shops/${shop.id}`, "PATCH", { stock: [{ id: itemId, stock }] });
    setBusy(null);
    if (!r.ok) {
      setShops(before);
      setError(`${shop.name}：${r.error}`);
    } else setMsg(`${shop.name}「${item.name}」を${STOCK_LABEL[stock]}に ・ ${savedAt()}`);
  }

  return (
    <div>
      <p className="st-saved" role="status" aria-live="polite">
        {msg}
      </p>
      {error && (
        <p className="st-err" role="alert">
          {error}
        </p>
      )}
      {DEPT_ORDER.map((d) => {
        const list = shops.filter((s) => s.dept === d);
        if (!list.length) return null;
        return (
          <section key={d} className={`st-dept d-${d}`} aria-labelledby={`st-d-${d}`}>
            <h2 id={`st-d-${d}`} className="st-dept-title">
              {DEPTS[d].name}
            </h2>
            <div className="st-cards">
              {list.map((s) => (
                <article key={s.id} className={`st-card d-${s.dept}`}>
                  <div className="st-card-head">
                    <Link href={`/staff/shops/${s.id}`} className="st-card-name">
                      {s.name}
                    </Link>
                    <span className="st-badge" data-v={s.state}>
                      {s.hidden ? "非公開" : STATE_LABEL[s.state]}
                    </span>
                  </div>
                  {s.notice && <p className="st-muted">お知らせ：{s.notice}</p>}
                  {s.menu.length ? (
                    <div className="st-chips">
                      {s.menu.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          className="st-chip"
                          data-v={m.stock}
                          disabled={busy === `${s.id}/${m.id}`}
                          onClick={() => cycle(s, m.id)}
                          aria-label={`${m.name}（いま ${STOCK_LABEL[m.stock]}。押すと${STOCK_LABEL[NEXT[m.stock]]}）`}
                        >
                          {m.name}
                          <span className="st-muted">{STOCK_LABEL[m.stock]}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="st-muted">品物なし</p>
                  )}
                </article>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
