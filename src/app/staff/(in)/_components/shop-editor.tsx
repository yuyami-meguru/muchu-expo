"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { TextArea } from "@/components/ui/field";
import { STATE_LABEL, STOCK_LABEL, type Shop, type ShopState, type Stock } from "@/lib/types";
import { savedAt, send } from "../../_lib/client";

const STATES: ShopState[] = ["prep", "open", "break", "closed"];
const STOCKS: Stock[] = ["on", "few", "out"];

/** お店の人の画面：状態・品物ごとの残り・お知らせ。押したらすぐ保存（失敗したら元に戻す） */
export function ShopEditor({ shop: initial }: { shop: Shop }) {
  const [shop, setShop] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(initial.notice);

  async function patch(key: string, body: object, apply: (s: Shop) => Shop) {
    const before = shop;
    setShop(apply(shop));
    setBusy(key);
    setError("");
    const r = await send(`/api/staff/shops/${shop.id}`, "PATCH", body);
    setBusy(null);
    if (!r.ok) {
      setShop(before);
      setError(r.error);
      return false;
    }
    setMsg(savedAt());
    return true;
  }

  return (
    <div className="st-stack">
      <p className="st-saved" role="status" aria-live="polite">
        {msg}
      </p>
      {error && (
        <p className="st-err" role="alert">
          {error}
        </p>
      )}

      <section aria-labelledby="st-state-h">
        <h2 id="st-state-h" className="t-h2">お店の状態</h2>
        <div className="st-states" role="group" aria-label="お店の状態">
          {STATES.map((v) => (
            <button
              key={v}
              type="button"
              className="st-state"
              data-v={v}
              aria-pressed={shop.state === v}
              disabled={busy === "state"}
              onClick={() => shop.state !== v && patch("state", { state: v }, (s) => ({ ...s, state: v }))}
            >
              {STATE_LABEL[v]}
            </button>
          ))}
        </div>
      </section>

      <section aria-labelledby="st-items-h">
        <h2 id="st-items-h" className="t-h2">売り切れ</h2>
        {shop.menu.length === 0 ? (
          <p className="st-muted">品物がまだありません。下の「お店の紹介を書く」の「メニュー」で品物を足すと、ここに売り切れのボタンが出ます。</p>
        ) : (
          <ul className="st-items">
            {shop.menu.map((m) => (
              <li key={m.id} className="st-item">
                <div className="st-item-head">
                  <span className="st-item-name">{m.name}</span>
                  {m.price && <span className="st-muted">{m.price}</span>}
                </div>
                <div className="st-stock" role="group" aria-label={`${m.name}の残り`}>
                  {STOCKS.map((v) => (
                    <button
                      key={v}
                      type="button"
                      className="st-stock-btn"
                      data-v={v}
                      aria-pressed={m.stock === v}
                      disabled={busy === m.id}
                      onClick={() =>
                        m.stock !== v &&
                        patch(m.id, { stock: [{ id: m.id, stock: v }] }, (s) => ({
                          ...s,
                          menu: s.menu.map((x) => (x.id === m.id ? { ...x, stock: v } : x)),
                        }))
                      }
                    >
                      {STOCK_LABEL[v]}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="st-notice-h">
        <h2 id="st-notice-h" className="t-h2">お客さんへのお知らせ</h2>
        <TextArea
          label="お店のページのいちばん上に出ます"
          hint={`「13時から焼き直しています」など（${notice.length}/120 字）`}
          value={notice}
          maxLength={120}
          rows={3}
          onChange={(e) => setNotice(e.target.value)}
        />
        <div className="st-row">
          <Button
            variant="primary"
            pending={busy === "notice"}
            disabled={notice === shop.notice}
            onClick={() => patch("notice", { notice }, (s) => ({ ...s, notice }))}
          >
            お知らせを出す
          </Button>
          {shop.notice && (
            <Button
              variant="ghost"
              onClick={async () => {
                if (await patch("notice", { notice: "" }, (s) => ({ ...s, notice: "" }))) setNotice("");
              }}
            >
              お知らせを消す
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}
