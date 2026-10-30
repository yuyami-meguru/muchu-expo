"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/icons";
import { STATE_LABEL, STOCK_LABEL, shopStock, type Shop, type ShopState, type Tone } from "@/lib/types";
import { savedAt, send } from "../../_lib/client";

const STATES: ShopState[] = ["prep", "open", "break", "closed"];

export type QuickRow = { shop: Shop; deptName: string; color: Tone; placeName: string };

/**
 * 実行委員の「お店の情報」の一覧。行を押すと編集の画面へ。
 * 当日よく使う 3 つ（営業の状態・売り切れ・非表示）は、一覧のまま押してすぐ保存する（失敗したら元に戻す）。
 */
export function ShopQuickList({ rows }: { rows: QuickRow[] }) {
  return (
    <ul className="st-list">
      {rows.map((r) => (
        <QuickItem key={r.shop.id} row={r} />
      ))}
    </ul>
  );
}

function QuickItem({ row }: { row: QuickRow }) {
  const [shop, setShop] = useState(row.shop);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  async function patch(body: object, apply: (s: Shop) => Shop, done: string) {
    const before = shop;
    setShop(apply(shop));
    setBusy(true);
    setError("");
    const r = await send(`/api/staff/shops/${shop.id}`, "PATCH", body);
    setBusy(false);
    if (!r.ok) {
      setShop(before);
      setMsg("");
      setError(r.error);
    } else setMsg(`${done} ・ ${savedAt()}`);
  }

  const stock = shopStock(shop);
  const allOut = stock === "out";
  // 売り切れのボタン：全部売り切れなら全部「販売中」に戻す。それ以外は全部「売り切れ」に
  function toggleOut() {
    const v = allOut ? "on" : "out";
    patch(
      { stock: shop.menu.map((m) => ({ id: m.id, stock: v })) },
      (s) => ({ ...s, menu: s.menu.map((m) => ({ ...m, stock: v })) }),
      allOut ? "全部を販売中に" : "全部を売り切れに",
    );
  }

  return (
    <li className={`tone-${row.color}`} data-hidden={shop.hidden || undefined}>
      <Link href={`/staff/shops/${shop.id}`} className="st-list-row">
        <span className="st-dot" aria-hidden="true" />
        <span className="st-grow">
          <strong>{shop.name}</strong>
          {shop.hidden && <span className="st-badge st-badge--hidden">非表示</span>}
          <br />
          <span className="st-muted">
            {row.deptName} ・ {row.placeName} ・ 品物 {shop.menu.length}
          </span>
        </span>
        <Icon name="右へ" size={20} />
      </Link>
      <div className="st-quick">
        <div className="st-states st-states--sm" role="group" aria-label={`${shop.name}の状態`}>
          {STATES.map((v) => (
            <button
              key={v}
              type="button"
              className="st-state"
              data-v={v}
              aria-pressed={shop.state === v}
              disabled={busy}
              onClick={() => shop.state !== v && patch({ state: v }, (s) => ({ ...s, state: v }), STATE_LABEL[v])}
            >
              {STATE_LABEL[v]}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="st-qbtn st-qbtn--out"
          aria-pressed={allOut}
          disabled={busy || !shop.menu.length}
          onClick={toggleOut}
          title={shop.menu.length ? undefined : "品物がまだありません"}
        >
          売り切れ
          <span className="st-qbtn-sub">{stock ? (stock === "few" ? "一部あり" : STOCK_LABEL[stock]) : "品物なし"}</span>
        </button>
        <button
          type="button"
          className="st-qbtn st-qbtn--hide"
          aria-pressed={shop.hidden}
          disabled={busy}
          onClick={() => patch({ hidden: !shop.hidden }, (s) => ({ ...s, hidden: !s.hidden }), shop.hidden ? "表示に" : "非表示に")}
        >
          非表示
          <span className="st-qbtn-sub">{shop.hidden ? "隠しています" : "見えています"}</span>
        </button>
        {(msg || error) && (
          <p className={error ? "st-quick-msg st-quick-msg--err" : "st-quick-msg"} role={error ? "alert" : "status"}>
            {error || msg}
          </p>
        )}
      </div>
    </li>
  );
}
