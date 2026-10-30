"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { phaseOf, type AdminLive, type Phase, type StaffLiveShop } from "@/lib/ops";
import { missingText, type Readiness } from "@/lib/readiness";
import { NO_DEPT, STATE_LABEL, type Dept, type Shop, type ShopState, type Stock, type Tone } from "@/lib/types";
import { clock, send } from "../../_lib/client";
import { useStaffLive } from "../../_lib/use-staff-live";
import { noteAuth, useReportLive } from "../_components/session-signal";
import { clockNow, latest, shapeOf, useShapeRefresh } from "../ops-live";
import { everyText, failMsg } from "../ops-result";
import "../ops.css";

const STATES: ShopState[] = ["prep", "open", "break", "closed"];

/** ready：お客さんに見せる準備（サーバーで lib/readiness.ts の readinessOf で決める） */
export type QuickRow = { shop: Shop; deptName: string; color: Tone; placeName: string; ready: Readiness };

/** しぼり込み（1 つだけ選ぶ）。数は、いまの値で数える */
type Filter = "all" | "todo" | "noplace" | "hidden" | "prep" | "out";
const FILTERS: { key: Filter; label: string; test: (r: QuickRow, s: Shop) => boolean }[] = [
  { key: "all", label: "すべて", test: () => true },
  { key: "todo", label: "準備がまだ", test: (r) => !r.ready.ready },
  { key: "noplace", label: "場所が未定", test: (r) => r.ready.missing.some((x) => x.key === "place") },
  { key: "hidden", label: "非表示", test: (_, s) => s.hidden },
  { key: "prep", label: "「準備中」のまま", test: (_, s) => !s.hidden && s.state === "prep" },
  { key: "out", label: "売り切れあり", test: (_, s) => s.menu.some((m) => m.stock === "out") },
];

/** 名前で探すときの形（全角・半角、大文字・小文字、カタカナ・ひらがなのちがいを無くす） */
const norm = (t: string) =>
  t
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
    .replace(/\s+/g, "");

/**
 * 実行委員の「お店の情報」の一覧。行を押すと編集の画面へ。部門ごとに見出しを付けて並べる。
 * 当日よく使う 3 つ（営業の状態・品物の売り切れ・お客さんの画面に出すか）は、一覧のまま押してすぐ保存する。
 * 15 秒ごとに「いまの様子」を読み直すので、お店の人が押した売り切れなども入る（読めないときは、いつの様子かを赤で出す）。
 * 上に準備の進み具合（「準備ができたお店 5／9」）、名前で探す欄と、しぼり込み（準備がまだ・場所が未定・非表示・「準備中」のまま・売り切れあり）。
 * しぼり込んだときに当てはまったお店は、押して当てはまらなくなっても、しぼり込みを変えるまで出しておく（押した結果が見えるように）
 */
export function ShopQuickList({ rows, depts, phase }: { rows: QuickRow[]; depts: Dept[]; phase: Phase }) {
  const { live, failed, expired, refresh } = useStaffLive<AdminLive>();
  useReportLive(live, expired);
  const [filter, setFilter] = useState<{ key: Filter; ids: string[] }>({ key: "all", ids: [] });
  const [q, setQ] = useState("");
  const searchId = useId();
  useShapeRefresh(live, shapeOf(rows.map((r) => r.shop)));

  const list = rows.filter((r) => !live || live.shops[r.shop.id]); // 消されたお店は出さない
  // しぼり込みは、15 秒ごとの「いまの様子」も入れた値で
  const now = (r: QuickRow) => latest(r.shop, null, live?.shops[r.shop.id]);
  const readyCount = list.filter((r) => r.ready.ready).length;
  const f = FILTERS.find((x) => x.key === filter.key) ?? FILTERS[0];
  const words = norm(q);
  const shown = list.filter(
    (r) => (filter.key === "all" || filter.ids.includes(r.shop.id) || f.test(r, now(r))) && (!words || norm(r.shop.name).includes(words) || r.shop.id.includes(words)),
  );
  const groups = [...depts, { ...NO_DEPT, id: "__none" }]
    .map((d) => ({ d, items: shown.filter((r) => (d.id === "__none" ? !depts.some((x) => x.id === r.shop.dept) : r.shop.dept === d.id)) }))
    .filter((g) => g.items.length);

  function pick(key: Filter) {
    setFilter({ key, ids: key === "all" ? [] : list.filter((r) => FILTERS.find((x) => x.key === key)!.test(r, now(r))).map((r) => r.shop.id) });
  }

  return (
    <>
      <p className={failed ? "ops-clock ops-clock--ng" : "ops-clock"}>
        <span>
          {!live
            ? "いまの様子を読んでいます…"
            : failed
              ? `読み直せませんでした（電波を確かめてください）。営業・売り切れの表示は ${clock(live.at)} のままです`
              : `営業・売り切れは ${clock(live.at)} の様子（${everyText(live.phase ? phaseOf(live.at, live.phase) : phase)}に更新）`}
        </span>
      </p>

      <div className="st-ready-bar">
        <p className="st-ready-count">
          準備ができたお店 <strong>{readyCount}／{list.length}</strong>
        </p>
      </div>

      <div className="st-find">
        <div className="ui-field st-find-q">
          <label className="ui-label" htmlFor={searchId}>
            名前で探す
          </label>
          <input id={searchId} type="search" className="ui-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="例：やきそば" autoComplete="off" enterKeyHint="search" />
        </div>
        <div className="st-filters" role="group" aria-label="しぼり込み">
          {FILTERS.map((x) => {
            const n = x.key === "all" ? list.length : list.filter((r) => x.test(r, now(r))).length;
            return (
              <button key={x.key} type="button" className="st-filter" aria-pressed={filter.key === x.key} onClick={() => pick(x.key)}>
                {x.label}
                <span className="st-filter-n">{n}</span>
              </button>
            );
          })}
        </div>
        {filter.key === "todo" && (
          <p className="st-ready-what">場所・ひとこと・どんなお店？・メニューと値段（食べる・飲むのお店だけ）のどれかが、まだ入っていないお店です</p>
        )}
        {filter.key !== "all" && <p className="st-ready-what">しぼり込んだときに当てはまったお店は、押して変わっても、しぼり込みを変えるまで出しておきます。</p>}
      </div>

      <p className="st-find-count" role="status">
        {filter.key === "all" && !words ? `お店 ${list.length}` : `${shown.length} 店が当てはまります（全部で ${list.length}）`}
      </p>

      {groups.length ? (
        groups.map(({ d, items }) => (
          <section key={d.id} className={`st-dept tone-${d.color}`} aria-labelledby={`st-qd-${d.id}`}>
            <h2 id={`st-qd-${d.id}`} className="st-dept-title">
              {d.name}
              <span className="st-dept-n">{items.length}</span>
            </h2>
            <ul className="st-list">
              {items.map((r) => (
                <QuickItem key={r.shop.id} row={r} live={live?.shops[r.shop.id]} onSaved={refresh} />
              ))}
            </ul>
          </section>
        ))
      ) : (
        <p className="st-ready-none">
          {!list.length
            ? "お店がまだありません（上の［＋ お店を足す］で足せます）"
            : words
              ? "その名前のお店は見つかりません"
              : filter.key === "todo"
                ? "✓ 全部のお店の準備ができています"
                : "当てはまるお店はありません"}
        </p>
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
  const [msg, setMsg] = useState<{ id: number; text: string; error: boolean } | null>(null);
  const msgId = useRef(0);
  const [hideOpen, setHideOpen] = useState(false);
  const [outOpen, setOutOpen] = useState(false);
  /** 「全部売り切れにする」を押す前の、品物ごとの残り（「販売を再開する」で元に戻す。この画面を開いているあいだだけ） */
  const [before, setBefore] = useState<Record<string, Stock> | null>(null);

  const base = latest(row.shop, mine, live);
  const shop: Shop = pending ? { ...base, ...pending } : base;
  const busy = !!pending;
  const id = `q-${shop.id}`;

  // うまくいった知らせは 6 秒で消す（失敗は、次に押すまで残す）
  useEffect(() => {
    if (!msg || msg.error) return;
    const t = setTimeout(() => setMsg((m) => (m?.id === msg.id ? null : m)), 6000);
    return () => clearTimeout(t);
  }, [msg]);

  /** what は「「休憩中」に」のような「何を」の所。done は成功の文 */
  async function patch(body: object, optimistic: Partial<Shop>, what: string, done: string) {
    if (busy) return false;
    setPending(optimistic);
    setMsg(null);
    const r = noteAuth(await send<{ shop: Shop | null }>(`/api/staff/shops/${shop.id}`, "PATCH", body));
    setPending(null);
    if (!r.ok) {
      setMsg({ id: ++msgId.current, text: failMsg(what, r), error: true });
      if (r.unsure) onSaved();
      return false;
    }
    if (r.shop) setMine(r.shop);
    setMsg({ id: ++msgId.current, text: `${done}（${clockNow()}）`, error: false });
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
      "全部の品物を売り切れに",
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
      "販売を再開",
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
            {row.placeName} ・ 品物 {shop.menu.length}
          </span>
          <br />
          <ReadyLine r={row.ready} />
        </span>
        <Icon name="右へ" size={20} />
      </Link>
      {/* 送っているあいだは「押せない」印だけ（disabled にすると、キーボードで選んでいた所が消えるため） */}
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
                aria-disabled={busy || undefined}
                onClick={() => shop.state !== v && patch({ state: v }, { state: v }, `「${STATE_LABEL[v]}」に`, `「${STATE_LABEL[v]}」にしました`)}
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
              <button type="button" className="st-qbtn" aria-disabled={busy || undefined} onClick={reopen}>
                販売を再開する
              </button>
            ) : (
              <button type="button" className="st-qbtn st-qbtn--out" aria-disabled={busy || undefined} onClick={() => !busy && (mixed ? setOutOpen(true) : soldOut())}>
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
              <button
                type="button"
                className="st-qbtn"
                aria-disabled={busy || undefined}
                onClick={() => patch({ hidden: false }, { hidden: false }, "お客さんの画面に出すことが", "お客さんの画面に出しました")}
              >
                見せる
              </button>
            ) : (
              <button type="button" className="st-qbtn st-qbtn--hide" aria-disabled={busy || undefined} onClick={() => !busy && setHideOpen(true)} aria-haspopup="dialog">
                隠す
              </button>
            )}
            <span className="st-qnow">いま：{shop.hidden ? "非表示" : "表示中"}</span>
          </div>
        </div>

        <p className={msg?.error ? "st-quick-msg st-quick-msg--err" : "st-quick-msg"} role={msg?.error ? "alert" : "status"}>
          {busy ? "送信中…" : msg?.text}
        </p>
      </div>

      <ConfirmDialog
        title={`『${shop.name}』をお客さんの画面から隠しますか？`}
        confirmLabel="隠す"
        open={hideOpen}
        onOpenChange={setHideOpen}
        onConfirm={async () => {
          await patch({ hidden: true }, { hidden: true }, "お客さんの画面から隠すことが", "お客さんの画面から隠しました");
        }}
      >
        お客さんの一覧・地図から消え、貼ってあるポスターの QR も「見つかりません」になります。［見せる］で、また出せます。
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
