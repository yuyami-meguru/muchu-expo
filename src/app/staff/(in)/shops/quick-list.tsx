"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/icons";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { AdminLive, StaffLiveShop } from "@/lib/ops";
import { missingText, type Readiness } from "@/lib/readiness";
import { STATE_LABEL, type Shop, type ShopState, type Stock, type Tone } from "@/lib/types";
import { send } from "../../_lib/client";
import { useStaffLive } from "../../_lib/use-staff-live";
import { OnlyToggle } from "../_components/only-toggle";
import { clockNow, latest, shapeOf, useShapeRefresh } from "../ops-live";
import "../ops.css";

const STATES: ShopState[] = ["prep", "open", "break", "closed"];

/** ready：お客さんに見せる準備（サーバーで lib/readiness.ts の readinessOf で決める） */
export type QuickRow = { shop: Shop; deptName: string; color: Tone; placeName: string; ready: Readiness };

/**
 * 実行委員の「お店の情報」の一覧。行を押すと編集の画面へ。
 * 当日よく使う 3 つ（営業の状態・品物の売り切れ・お客さんの画面に出すか）は、一覧のまま押してすぐ保存する。
 * 15 秒ごとに「いまの様子」を読み直すので、お店の人が押した売り切れなども入る。
 * 上に準備の進み具合（「準備ができたお店 5／9」と［まだのお店だけ］）、行の名前の下に「まだ：場所・ひとこと」（声をかけるお店を探す）
 */
export function ShopQuickList({ rows }: { rows: QuickRow[] }) {
  const { live, refresh } = useStaffLive<AdminLive>();
  const [onlyTodo, setOnlyTodo] = useState(false);
  useShapeRefresh(live, shapeOf(rows.map((r) => r.shop)));
  const list = rows.filter((r) => !live || live.shops[r.shop.id]); // 消されたお店は出さない
  const readyCount = list.filter((r) => r.ready.ready).length;
  const shown = onlyTodo ? list.filter((r) => !r.ready.ready) : list;
  return (
    <>
      <div className="st-ready-bar">
        <p className="st-ready-count">
          準備ができたお店 <strong>{readyCount}／{list.length}</strong>
        </p>
        <OnlyToggle on={onlyTodo} onChange={setOnlyTodo}>
          まだのお店だけ
        </OnlyToggle>
        {onlyTodo && <p className="st-ready-what">場所・ひとこと・どんなお店？・メニューと値段（食べる・飲むのお店だけ）のどれかが、まだ入っていないお店です</p>}
      </div>
      {shown.length ? (
        <ul className="st-list">
          {shown.map((r) => (
            <QuickItem key={r.shop.id} row={r} live={live?.shops[r.shop.id]} onSaved={refresh} />
          ))}
        </ul>
      ) : (
        <p className="st-ready-none">{list.length ? "✓ 全部のお店の準備ができています" : "お店がまだありません（下の「お店を足す」で足せます）"}</p>
      )}
    </>
  );
}

/** 行に出す準備の進み具合（「まだ：場所・ひとこと」か「✓ 準備ができました」）。値段が空の品物があれば、そのことも小さく */
function ReadyLine({ r }: { r: Readiness }) {
  // 食べる・飲むのお店の「値段」は「まだ」に入っている。ほかのお店は、あれば知らせるだけ
  const price = r.noPrice > 0 && !r.missing.some((x) => x.key === "menu");
  return (
    <>
      <span className={r.ready ? "st-ready st-ready--ok" : "st-ready"}>{r.ready ? "✓ 準備ができました" : `まだ：${missingText(r)}`}</span>
      {price && <span className="st-ready-price"> ・ 値段が未定の品物あり</span>}
    </>
  );
}

/** 品物の残りのいま（「販売中」「一部売り切れ（5 つ中 2 つ）」など） */
function stockNow(menu: Shop["menu"]) {
  const out = menu.filter((m) => m.stock === "out").length;
  const few = menu.filter((m) => m.stock === "few").length;
  if (out === menu.length) return "全部売り切れ";
  if (out) return `一部売り切れ（${menu.length} つ中 ${out} つ）`;
  if (few) return `残りわずか（${menu.length} つ中 ${few} つ）`;
  return "販売中";
}

function QuickItem({ row, live, onSaved }: { row: QuickRow; live: StaffLiveShop | undefined; onSaved: () => void }) {
  const [mine, setMine] = useState<Shop | null>(null);
  /** 送っている間に先に出しておく値。答えが来るまで、このお店のボタンは押せない */
  const [pending, setPending] = useState<Partial<Shop> | null>(null);
  const [msg, setMsg] = useState<{ text: string; error: boolean } | null>(null);
  const [hideOpen, setHideOpen] = useState(false);
  const [outOpen, setOutOpen] = useState(false);
  /** 「全部売り切れにする」を押す前の、品物ごとの残り（「販売を再開する」で元に戻す。この画面を開いているあいだだけ） */
  const [before, setBefore] = useState<Record<string, Stock> | null>(null);

  const base = latest(row.shop, mine, live);
  const shop: Shop = pending ? { ...base, ...pending } : base;
  const busy = !!pending;
  const id = `q-${shop.id}`;

  async function patch(body: object, optimistic: Partial<Shop>, done: string) {
    setPending(optimistic);
    setMsg(null);
    const r = await send<{ shop: Shop | null }>(`/api/staff/shops/${shop.id}`, "PATCH", body);
    setPending(null);
    if (!r.ok) {
      setMsg({ text: r.error, error: true });
      return false;
    }
    if (r.shop) setMine(r.shop);
    setMsg({ text: `${done}・${clockNow()}`, error: false });
    onSaved();
    return true;
  }

  const allOut = shop.menu.length > 0 && shop.menu.every((m) => m.stock === "out");
  const mixed = new Set(shop.menu.map((m) => m.stock)).size > 1;
  const count = (v: Stock) => shop.menu.filter((m) => m.stock === v).length;

  async function soldOut() {
    const keep = Object.fromEntries(shop.menu.map((m) => [m.id, m.stock]));
    const ok = await patch(
      { stock: shop.menu.map((m) => ({ id: m.id, stock: "out" })) },
      { menu: shop.menu.map((m) => ({ ...m, stock: "out" as const })) },
      "全部の品物を売り切れにしました",
    );
    if (ok) setBefore(keep);
  }

  async function reopen() {
    // この画面で覚えていれば、売り切れにする前の残りに戻す（覚えていなければ全部「販売中」）
    const back = (m: Shop["menu"][number]): Stock => before?.[m.id] ?? "on";
    const restored = !!before && shop.menu.some((m) => before[m.id] !== undefined && before[m.id] !== "on");
    const ok = await patch(
      { stock: shop.menu.map((m) => ({ id: m.id, stock: back(m) })) },
      { menu: shop.menu.map((m) => ({ ...m, stock: back(m) })) },
      restored ? "販売を再開しました（売り切れにする前の残りに戻しました）" : "販売を再開しました（全部を販売中に）",
    );
    if (ok) setBefore(null);
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
          <br />
          <ReadyLine r={row.ready} />
        </span>
        <Icon name="右へ" size={20} />
      </Link>
      <div className="st-quick" aria-busy={busy || undefined}>
        <div className="st-qgroup st-qgroup--state" role="group" aria-labelledby={`${id}-state`}>
          <p className="st-qgroup-h" id={`${id}-state`}>
            営業
          </p>
          <div className="st-states st-states--sm">
            {STATES.map((v) => (
              <button
                key={v}
                type="button"
                className="st-state"
                data-v={v}
                aria-pressed={shop.state === v}
                disabled={busy}
                onClick={() => shop.state !== v && patch({ state: v }, { state: v }, `「${STATE_LABEL[v]}」にしました`)}
              >
                {STATE_LABEL[v]}
              </button>
            ))}
          </div>
        </div>

        <div className="st-qgroup" role="group" aria-labelledby={`${id}-stock`}>
          <p className="st-qgroup-h" id={`${id}-stock`}>
            品物
          </p>
          <div className="st-qline">
            {!shop.menu.length ? null : allOut ? (
              <button type="button" className="st-qbtn" disabled={busy} onClick={reopen}>
                販売を再開する
              </button>
            ) : (
              <button type="button" className="st-qbtn st-qbtn--out" disabled={busy} onClick={() => (mixed ? setOutOpen(true) : soldOut())}>
                全部売り切れにする
              </button>
            )}
            <span className="st-qnow">{shop.menu.length ? `いま：${stockNow(shop.menu)}` : "品物がまだありません（名前を押してメニューに足せます）"}</span>
          </div>
        </div>

        <div className="st-qgroup" role="group" aria-labelledby={`${id}-view`}>
          <p className="st-qgroup-h" id={`${id}-view`}>
            お客さんの画面
          </p>
          <div className="st-qline">
            {shop.hidden ? (
              <button type="button" className="st-qbtn" disabled={busy} onClick={() => patch({ hidden: false }, { hidden: false }, "お客さんの画面に出しました")}>
                見せる
              </button>
            ) : (
              <button type="button" className="st-qbtn st-qbtn--hide" disabled={busy} onClick={() => setHideOpen(true)} aria-haspopup="dialog">
                隠す
              </button>
            )}
            <span className="st-qnow">いま：{shop.hidden ? "非表示" : "表示中"}</span>
          </div>
        </div>

        <p className={msg?.error ? "st-quick-msg st-quick-msg--err" : "st-quick-msg"} role={msg?.error ? "alert" : "status"}>
          {msg?.text}
        </p>
      </div>

      <ConfirmDialog
        title={`『${shop.name}』をお客さんの画面から隠しますか？`}
        confirmLabel="隠す"
        open={hideOpen}
        onOpenChange={setHideOpen}
        onConfirm={async () => {
          await patch({ hidden: true }, { hidden: true }, "お客さんの画面から隠しました");
        }}
      >
        一覧・地図から消え、貼ってあるポスターの QR も「見つかりません」になります。
      </ConfirmDialog>
      <ConfirmDialog
        title={`全部の品物（${shop.menu.length} つ）を売り切れにしますか？`}
        confirmLabel="全部売り切れにする"
        open={outOpen}
        onOpenChange={setOutOpen}
        onConfirm={soldOut}
      >
        いまの残り：販売中 {count("on")}・残りわずか {count("few")}・売り切れ {count("out")}。
        <br />
        このあと「販売を再開する」を押すと、この画面を開いているあいだは、いまの残りに戻せます。
      </ConfirmDialog>
    </li>
  );
}
