"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { TextArea } from "@/components/ui/field";
import type { StaffLiveShop } from "@/lib/ops";
import { STATE_LABEL, STOCK_LABEL, type MenuItem, type Shop, type ShopState, type Stock } from "@/lib/types";
import { clock, send } from "../../_lib/client";
import { ResultLine, failText, nowClock, visible, without, type Result } from "./shop-result";
import { useLeaveGuard } from "./use-leave-guard";

const STATES: ShopState[] = ["prep", "open", "break", "closed"];
const STOCKS: Stock[] = ["on", "few", "out"];

/**
 * 状態・残りのボタン 1 つ。いまの値には「✓ 」、送っている途中は「送信中…」、
 * 送れなかった値には「もう一度」（押すと同じ値をもう一度送る。別のボタンを足さないので、出ても下がずれない）
 */
function Choice({
  className,
  v,
  label,
  pressed,
  sending,
  again,
  disabled,
  onClick,
}: {
  className: string;
  v: string;
  label: string;
  pressed: boolean;
  sending: boolean;
  again: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" className={className} data-v={v} data-again={again || undefined} aria-pressed={pressed} disabled={disabled} onClick={onClick}>
      {pressed && <span aria-hidden="true">✓ </span>}
      {label}
      {sending && <span className="sh-sending">送信中…</span>}
      {again && <span className="sh-again">もう一度</span>}
    </button>
  );
}

/**
 * お店の人の画面：状態・品物ごとの残り・お店からのお知らせ。押したら必ず送る（いまと同じ値でも）。
 *  - 出す値：送っている途中なら押した値、そうでなければ now（ほかのスマホや実行委員が変えた分も入る、いちばん新しい様子）
 *  - 結果は押した所のすぐ下に出す（送信中は押したボタンに「送信中…」、成功は「✓ 売り切れにしました 12:03」、
 *    失敗は赤い枠と文、押したボタンに「もう一度」）。失敗したら、その品物だけ元に戻る（ほかの品物の送信はそのまま）
 */
export function ShopEditor({
  shop,
  now,
  noticeAt,
  onShop,
}: {
  /** 品物の名前・値段・並び（紹介を保存すると変わる） */
  shop: Shop;
  /** いまの状態・残り・お知らせ（いちばん新しく分かっているもの） */
  now: StaffLiveShop;
  /** いまのお知らせを出した時刻（分からなければ null） */
  noticeAt: number | null;
  /** 保存の答え（最新のお店）を、画面ぜんたいに渡す */
  onShop: (s: Shop) => void;
}) {
  // 送っている途中のもの（"state"・"notice"・"s:品物の id" → 押した値）
  const [sending, setSending] = useState<Record<string, string>>({});
  // 押した結果（同じ並び）
  const [results, setResults] = useState<Record<string, Result>>({});
  // お知らせの書きかけ（null＝書きかえていない。いま出ているお知らせをそのまま見せる）
  const [draft, setDraft] = useState<string | null>(null);

  /** 1 つ送る。key ごとに「送信中」と結果を持つので、ほかの品物を続けて押しても混ざらない */
  async function run(key: string, value: string, body: object, done: string, failed: string, after?: () => void) {
    setSending((m) => ({ ...m, [key]: value }));
    // 送り始めに、前の「✓ …しました」やまちがいを消す
    setResults((m) => without(m, key));
    const r = await send<{ shop: Shop | null }>(`/api/staff/shops/${shop.id}`, "PATCH", body);
    setSending((m) => without(m, key));
    if (!r.ok) {
      const retry = () => void run(key, value, body, done, failed, after);
      setResults((m) => ({ ...m, [key]: { ok: false, value, text: failText(failed, r.error), retry } }));
      return;
    }
    // 答えのお店（最新）で画面をそろえる
    if (r.shop) onShop(r.shop);
    after?.();
    setResults((m) => ({ ...m, [key]: { ok: true, value, text: `✓ ${done} ${nowClock()}` } }));
  }

  const setState = (v: ShopState) => run("state", v, { state: v }, `${STATE_LABEL[v]}にしました`, `${STATE_LABEL[v]}にできませんでした`);
  const setStock = (m: MenuItem, v: Stock) =>
    run(`s:${m.id}`, v, { stock: [{ id: m.id, stock: v }] }, `${STOCK_LABEL[v]}にしました`, `${STOCK_LABEL[v]}にできませんでした`);

  const state = (sending.state as ShopState | undefined) ?? now.state;
  const stateResult = visible(results.state, state);

  // お知らせ：欄には書きかけ、なければいま出ているもの
  const written = draft ?? now.notice;
  const noticeResult = visible(results.notice, now.notice);
  useLeaveGuard(draft !== null && draft.trim() !== "" && draft.trim() !== now.notice);

  function publish() {
    const text = written.trim();
    if (!text) {
      setResults((m) => ({ ...m, notice: { ok: false, text: now.notice ? "お知らせの文を書いてください（消すときは［お知らせを消す］）" : "お知らせの文を書いてください" } }));
      return;
    }
    // 出せたら書きかけを閉じる（送っているあいだに書き足した分は残す）
    void run("notice", text, { notice: text }, "お知らせを出しました", "お知らせを出せませんでした", () => setDraft((d) => (d === null || d.trim() === text ? null : d)));
  }

  return (
    <div className="st-stack">
      <section aria-labelledby="st-state-h">
        <h2 id="st-state-h" className="t-h2">
          お店の状態
        </h2>
        <div className="sh-box" data-ng={stateResult && !stateResult.ok ? "" : undefined}>
          <div className="st-states" role="group" aria-label="お店の状態">
            {STATES.map((v) => (
              <Choice
                key={v}
                className="st-state"
                v={v}
                label={STATE_LABEL[v]}
                pressed={state === v}
                sending={sending.state === v}
                again={!!stateResult && !stateResult.ok && stateResult.value === v}
                disabled={"state" in sending}
                onClick={() => setState(v)}
              />
            ))}
          </div>
          <ResultLine result={stateResult} again={false} />
        </div>
      </section>

      <section aria-labelledby="st-items-h">
        <h2 id="st-items-h" className="t-h2">
          売り切れ
        </h2>
        {shop.menu.length === 0 ? (
          <p className="st-muted">品物がまだありません。下の「お店の紹介を書く」の「メニュー」で品物を足すと、ここに売り切れのボタンが出ます。</p>
        ) : (
          <ul className="st-items">
            {shop.menu.map((m) => {
              const key = `s:${m.id}`;
              const cur = (sending[key] as Stock | undefined) ?? now.stock[m.id] ?? m.stock;
              const res = visible(results[key], cur);
              return (
                <li key={m.id} className="st-item" data-ng={res && !res.ok ? "" : undefined}>
                  <div className="st-item-head">
                    <span className="st-item-name">{m.name}</span>
                    {m.price && <span className="st-muted">{m.price}</span>}
                  </div>
                  <div className="st-stock" role="group" aria-label={`${m.name}の残り`}>
                    {STOCKS.map((v) => (
                      <Choice
                        key={v}
                        className="st-stock-btn"
                        v={v}
                        label={STOCK_LABEL[v]}
                        pressed={cur === v}
                        sending={sending[key] === v}
                        again={!!res && !res.ok && res.value === v}
                        disabled={key in sending}
                        onClick={() => setStock(m, v)}
                      />
                    ))}
                  </div>
                  <ResultLine result={res} again={false} />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="st-notice-h">
        <h2 id="st-notice-h" className="t-h2">
          お店からのお知らせ
        </h2>
        <p className="sh-notice-now">
          {now.notice ? (
            <>
              いまお客さんに出ているお知らせ：<strong>『{now.notice}』</strong>
              {noticeAt ? `（${clock(noticeAt)} から）` : ""}
            </>
          ) : (
            "いまは出ていません"
          )}
        </p>
        <TextArea
          label="お知らせの文"
          hint={`お店のページのいちばん上に出ます。例：13:00 から焼き直しています（${written.length}/120 字）`}
          value={written}
          maxLength={120}
          rows={3}
          onChange={(e) => {
            setDraft(e.target.value);
            setResults((m) => without(m, "notice"));
          }}
        />
        <div className="sh-notice-row">
          <Button variant="primary" pending={sending.notice !== undefined && sending.notice !== ""} disabled={"notice" in sending} onClick={publish}>
            {now.notice ? "お知らせを変える" : "お知らせを出す"}
          </Button>
          {now.notice && (
            <Button
              variant="ghost"
              size="sm"
              pending={sending.notice === ""}
              disabled={"notice" in sending}
              onClick={() => run("notice", "", { notice: "" }, "お知らせを消しました", "お知らせを消せませんでした")}
            >
              お知らせを消す
            </Button>
          )}
          <ResultLine result={noticeResult} className="sh-result--side" />
        </div>
      </section>
    </div>
  );
}
