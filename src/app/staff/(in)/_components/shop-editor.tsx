"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { TextArea } from "@/components/ui/field";
import type { StaffLiveShop } from "@/lib/ops";
import { STATE_LABEL, STOCK_LABEL, type MenuItem, type Shop, type ShopState, type Stock } from "@/lib/types";
import { send } from "../../_lib/client";
import { ResultLine, doneText, failText, settle, stamp, visible, without, type Result } from "./shop-result";
import { useLeaveGuard } from "./use-leave-guard";

const STATES: ShopState[] = ["prep", "open", "break", "closed"];
const STOCKS: Stock[] = ["on", "few", "out"];
/** ［元に戻す］を出しておく時間（押しまちがいはすぐ気づく。長く残すと、あとで［元に戻す］のほうを押しまちがえる） */
const UNDO_MS = 60_000;
/** お知らせの書きかけを残す場所（この端末の中だけ。お店ごと）。［使い方］へ移って戻っても消えないように */
const noticeKey = (shopId: string) => `muchu-notice-${shopId}`;

/**
 * 状態・残りのボタン 1 つ。いまの値（届いて保存されたもの）にだけ「✓」、送っている途中は「送信中…」（✓ は届いてから付ける）、
 * 送れなかった値には「もう一度」（押すと同じ値をもう一度送る。別のボタンを足さないので、出ても下がずれない）。
 * 送っているあいだも disabled にはしない（押したボタンからフォーカスが外れて、キーボードや読み上げの人が場所を見失うので）。
 * 二重に送らないよう、押したときに blocked なら何もしない
 */
function Choice({
  kind,
  v,
  label,
  pressed,
  sending,
  again,
  blocked,
  onPress,
}: {
  kind: "state" | "stock";
  v: string;
  label: string;
  pressed: boolean;
  sending: boolean;
  again: boolean;
  blocked: boolean;
  onPress: () => void;
}) {
  return (
    <button
      type="button"
      className={`sh-choice sh-choice--${kind}`}
      data-v={v}
      data-again={again || undefined}
      data-sending={sending || undefined}
      aria-pressed={pressed}
      aria-disabled={blocked || undefined}
      onClick={() => {
        if (!blocked) onPress();
      }}
    >
      {pressed && <span className="sh-mark" aria-hidden="true">✓</span>}
      <span className="sh-choice-label">
        {v === "few" ? (
          <>
            残り
            <wbr />
            わずか
          </>
        ) : (
          label
        )}
      </span>
      {sending && <span className="sh-sending">送信中…</span>}
      {again && <span className="sh-again">もう一度</span>}
    </button>
  );
}

/** 1 回の送信：key ごとに「送信中」と結果を持つ（ほかの品物を続けて押しても混ざらない） */
type Act = {
  key: string;
  value: string;
  body: (v: string) => object;
  /** 成功の文（「売り切れにしました」。時刻はあとで付ける） */
  ok: string;
  /** 失敗の文の頭（「売り切れにできませんでした」） */
  ng: string;
  /** 読み上げだけの前置き（「バナナジュースを」） */
  sr?: string;
  /** ［元に戻す］で送るもの（押す前の値） */
  undo?: { value: string; ok: string; ng: string };
  after?: () => void;
};

/**
 * お店の人の画面：品物ごとの残り・状態・お店からのお知らせ。押したら必ず送る（いまと同じ値でも）。
 *  - ボタンの ✓ は、いまの値（ほかのスマホや実行委員が変えた分も入る、いちばん新しい様子）
 *  - 結果は押した所のすぐ下に 1 行（場所は先に空けておく）：成功は「✓ 売り切れにしました（12:03）［元に戻す］」、
 *    失敗は赤い文と、押したボタンに「もう一度」。返事が来なかった（打ち切り）ときは「確かめています…」と出して
 *    すぐ読み直し、押した値になっていれば成功、なっていなければ「届いていませんでした」
 *  - ログインが切れた（401）ときは［もう一度］を出さない（押してもむだ）。画面の上に入り直し方を出す
 */
export function ShopEditor({
  shop,
  now,
  noticeAt,
  today,
  liveAt,
  failed,
  layout,
  guestsSee,
  onShop,
  onCheck,
  onExpired,
}: {
  /** 品物の名前・値段・並び（紹介を保存すると変わる） */
  shop: Shop;
  /** いまの状態・残り・お知らせ（いちばん新しく分かっているもの） */
  now: StaffLiveShop;
  /** いまのお知らせを出した時刻（分からなければ null） */
  noticeAt: number | null;
  /** 日付を付けるか決める基準の時刻（サーバー。分からなければ null） */
  today: number | null;
  /** いま分かっている「いまの様子」の時刻（届いたか確かめるのに使う。まだなければ 0） */
  liveAt: number;
  /** 「いまの様子」を読めていない（押せたら読み直して、赤い行を消す） */
  failed: boolean;
  /** 画面の並び（開催前は、この部品ごと下にたたんである。品物がなくても売り切れの欄を出して、足し方を案内する） */
  layout: "before" | "day";
  /** いま押すと、お客さんの画面に出るか（当日の朝・開催中） */
  guestsSee: boolean;
  onShop: (s: Shop) => void;
  /** 「いまの様子」をすぐ読み直す */
  onCheck: () => Promise<void>;
  /** ログインが切れたと分かった */
  onExpired: () => void;
}) {
  // 送っている途中のもの（"state"・"notice"・"s:品物の id" → 押した値）
  const [sending, setSending] = useState<Record<string, string>>({});
  // 押した結果（同じ並び）
  const [results, setResults] = useState<Record<string, Result>>({});
  // お知らせの書きかけ（null＝書きかえていない。いま出ているお知らせをそのまま見せる）
  const [draft, setDraft] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);
  const [noticeReady, setNoticeReady] = useState(false);
  // 送っている途中の key（同じ所の二重送信を、押したその場で止める。state は次の描画まで変わらないので）
  const busy = useRef(new Set<string>());
  // 確かめ始めたときの「いまの様子」の時刻・読めていないか（送っているあいだに変わるので、いつも新しい値を見る）
  const liveAtRef = useRef(liveAt);
  const failedRef = useRef(failed);
  const firstNotice = useRef(now.notice);
  useEffect(() => {
    liveAtRef.current = liveAt;
    failedRef.current = failed;
  });

  async function run(a: Act) {
    if (busy.current.has(a.key)) return;
    busy.current.add(a.key);
    setSending((m) => ({ ...m, [a.key]: a.value }));
    // 送り始めに、前の「✓ …しました」やまちがいを消す
    setResults((m) => without(m, a.key));
    const r = await send<{ shop: Shop | null }>(`/api/staff/shops/${shop.id}`, "PATCH", a.body(a.value));
    busy.current.delete(a.key);
    setSending((m) => without(m, a.key));
    const retry = () => void run(a);
    const back = a.undo;
    const undo = back ? () => void run({ ...a, value: back.value, ok: back.ok, ng: back.ng, undo: undefined, after: undefined }) : undefined;
    // ［元に戻す］はしばらくしたら消す（文は残す）
    const expire = () => {
      if (undo) setTimeout(() => setResults((m) => (m[a.key]?.undo === undo ? { ...m, [a.key]: { ...m[a.key], undo: undefined } } : m)), UNDO_MS);
    };

    if (r.ok) {
      // 答えのお店（最新）で画面をそろえる
      if (r.shop) onShop(r.shop);
      a.after?.();
      setResults((m) => ({ ...m, [a.key]: { ok: true, value: a.value, text: doneText(a.ok), sr: a.sr, undo } }));
      expire();
      // 赤い「いまの様子を読めていません」が出ていたら、読み直して消す（送れたのだから電波は戻っている）
      if (failedRef.current) void onCheck();
      return;
    }
    if (r.unsure) {
      // 返事を待ちきれなかった：届いているかもしれない。すぐ読み直して、押した値になっているかで決める（settle）
      const res: Result = {
        ok: false,
        value: a.value,
        text: "",
        sr: a.sr,
        retry,
        undo,
        check: { seenAt: liveAtRef.current, done: false, okText: doneText(a.ok), ngText: "届いていませんでした。もう一度押してください" },
      };
      setResults((m) => ({ ...m, [a.key]: res }));
      expire();
      await onCheck();
      setResults((m) => (m[a.key]?.check && m[a.key].retry === retry ? { ...m, [a.key]: { ...m[a.key], check: { ...m[a.key].check!, done: true } } } : m));
      return;
    }
    if (r.status === 401) {
      onExpired();
      setResults((m) => ({ ...m, [a.key]: { ok: false, value: a.value, sr: a.sr, text: "ログインが切れました。お店の QR をもう一度読み取ってください" } }));
      return;
    }
    setResults((m) => ({ ...m, [a.key]: { ok: false, value: a.value, sr: a.sr, text: failText(a.ng, r.error), retry } }));
  }

  /** 失敗して「もう一度」を押したボタンに出すか（確かめ中・ログイン切れは出さない） */
  const againOn = (res: Result | undefined, v: string) => !!res && !res.ok && !res.wait && !!res.retry && res.value === v;

  const setState = (v: ShopState) =>
    run({
      key: "state",
      value: v,
      body: (x) => ({ state: x }),
      ok: `${STATE_LABEL[v]}にしました`,
      ng: `${STATE_LABEL[v]}にできませんでした`,
      sr: "お店の状態を",
      undo: now.state !== v ? { value: now.state, ok: `${STATE_LABEL[now.state]}に戻しました`, ng: `${STATE_LABEL[now.state]}に戻せませんでした` } : undefined,
    });
  const setStock = (m: MenuItem, v: Stock, cur: Stock) =>
    run({
      key: `s:${m.id}`,
      value: v,
      body: (x) => ({ stock: [{ id: m.id, stock: x }] }),
      ok: `${STOCK_LABEL[v]}にしました`,
      ng: `${STOCK_LABEL[v]}にできませんでした`,
      sr: `${m.name}を`,
      undo: cur !== v ? { value: cur, ok: `${STOCK_LABEL[cur]}に戻しました`, ng: `${STOCK_LABEL[cur]}に戻せませんでした` } : undefined,
    });

  const stateRes = visible(settle(results.state, now.state, liveAt), now.state);

  // お知らせ：欄には書きかけ、なければいま出ているもの
  const written = draft ?? now.notice;
  const unsent = draft !== null && draft.trim() !== "" && draft.trim() !== now.notice;
  const noticeRes = visible(settle(results.notice, now.notice, liveAt), now.notice);
  useLeaveGuard(unsent);

  // 開いたとき：この端末にお知らせの書きかけが残っていれば戻す（［使い方］へ移って戻ったときなど）
  const nk = noticeKey(shop.id);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(nk);
      const d = raw ? (JSON.parse(raw) as { text?: unknown }) : null;
      if (d && typeof d.text === "string" && d.text.trim() && d.text.trim() !== firstNotice.current) {
        /* eslint-disable react-hooks/set-state-in-effect -- 端末の中は、画面を出したあとでしか読めない */
        setDraft(d.text.slice(0, 120));
        setRestored(true);
        /* eslint-enable react-hooks/set-state-in-effect */
      }
    } catch {
      // 読めない書きかけは使わない
    }
    setNoticeReady(true);
  }, [nk]);

  // 出していない書きかけを、この端末に残す（出したら・いまのお知らせと同じにしたら消す）
  useEffect(() => {
    if (!noticeReady) return;
    try {
      if (unsent) localStorage.setItem(nk, JSON.stringify({ at: Date.now(), text: draft }));
      else localStorage.removeItem(nk);
    } catch {
      // 残せない端末（プライベートブラウズなど）は、そのまま
    }
  }, [noticeReady, unsent, draft, nk]);

  function publish() {
    const text = written.trim();
    if (!text) {
      setResults((m) => ({ ...m, notice: { ok: false, text: now.notice ? "お知らせの文を書いてください（やめるときは［お知らせを消す］）" : "お知らせの文を書いてください" } }));
      return;
    }
    const prev = now.notice;
    // 出せたら書きかけを閉じる（送っているあいだに書き足した分は残す）
    void run({
      key: "notice",
      value: text,
      body: (x) => ({ notice: x }),
      ok: "お知らせを出しました",
      ng: "お知らせを出せませんでした",
      undo: prev !== text ? { value: prev, ok: prev ? "前のお知らせに戻しました" : "お知らせを消しました", ng: "元に戻せませんでした" } : undefined,
      after: () => {
        setDraft((d) => (d === null || d.trim() === text ? null : d));
        setRestored(false);
      },
    });
  }

  function clear() {
    const prev = now.notice;
    void run({
      key: "notice",
      value: "",
      body: (x) => ({ notice: x }),
      ok: "お知らせを消しました",
      ng: "お知らせを消せませんでした",
      undo: prev ? { value: prev, ok: "お知らせを元に戻しました", ng: "お知らせを元に戻せませんでした" } : undefined,
    });
  }

  const noticeBusy = "notice" in sending;
  const hint = unsent
    ? `${restored ? "書きかけを戻しました。" : ""}まだ出していません。［${now.notice ? "お知らせを変える" : "お知らせを出す"}］を押すと出ます（${written.length}/120 字）`
    : `お店のページのいちばん上に出ます。例：13:00 から焼き直しています（${written.length}/120 字）`;

  return (
    <div className="st-stack sh-editor">
      {(shop.menu.length > 0 || layout === "before") && (
        <section aria-labelledby="sh-items-h">
          <h2 id="sh-items-h" className="t-h2">
            売り切れ
          </h2>
          {shop.menu.length === 0 ? (
            <p className="st-muted">
              品物がまだありません。「お店の紹介を書く」の「メニュー」で品物を足すと、ここに売り切れのボタンが出ます（品物を売らないお店・出し物は、使わなくて大丈夫です）。
            </p>
          ) : (
            <ul className="sh-items">
              {shop.menu.map((m) => {
                const key = `s:${m.id}`;
                const cur = now.stock[m.id] ?? m.stock;
                const res = visible(settle(results[key], cur, liveAt), cur);
                return (
                  <li key={m.id} className="sh-item" data-ng={res && !res.ok && !res.wait ? "" : undefined}>
                    <div className="sh-item-head">
                      <span className="sh-item-name">{m.name}</span>
                      {m.price && <span className="st-muted">{m.price}</span>}
                    </div>
                    <div className="sh-stocks" role="group" aria-label={`${m.name}の残り`}>
                      {STOCKS.map((v) => (
                        <Choice
                          key={v}
                          kind="stock"
                          v={v}
                          label={STOCK_LABEL[v]}
                          pressed={cur === v}
                          sending={sending[key] === v}
                          again={againOn(res, v)}
                          blocked={key in sending}
                          onPress={() => setStock(m, v, cur)}
                        />
                      ))}
                    </div>
                    <ResultLine result={res} again={false} className="sh-result--row" />
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      <section aria-labelledby="sh-state-h">
        <h2 id="sh-state-h" className="t-h2">
          お店の状態
        </h2>
        <div className="sh-box" data-ng={stateRes && !stateRes.ok && !stateRes.wait ? "" : undefined}>
          <div className="sh-states" role="group" aria-label="お店の状態">
            {STATES.map((v) => (
              <Choice
                key={v}
                kind="state"
                v={v}
                label={STATE_LABEL[v]}
                pressed={now.state === v}
                sending={sending.state === v}
                again={againOn(stateRes, v)}
                blocked={"state" in sending}
                onPress={() => setState(v)}
              />
            ))}
          </div>
          <ResultLine result={stateRes} again={false} className="sh-result--row" />
        </div>
      </section>

      <section aria-labelledby="sh-notice-h">
        <h2 id="sh-notice-h" className="t-h2">
          お店からのお知らせ
        </h2>
        <p className="sh-notice-now">
          {now.notice ? (
            <>
              {guestsSee ? "いまお客さんに出ているお知らせ：" : "いま入っているお知らせ（いまはお客さんに出ません）："}
              <strong>『{now.notice}』</strong>
              {noticeAt ? `（${stamp(noticeAt, today)} から）` : ""}
            </>
          ) : (
            "いまは出ていません"
          )}
        </p>
        <TextArea
          label="お知らせの文"
          hint={hint}
          value={written}
          maxLength={120}
          rows={3}
          onChange={(e) => {
            setDraft(e.target.value);
            setResults((m) => without(m, "notice"));
          }}
        />
        <div className="sh-notice-row">
          <Button
            variant="primary"
            pending={sending.notice !== undefined && sending.notice !== ""}
            aria-disabled={noticeBusy || undefined}
            onClick={() => !noticeBusy && publish()}
          >
            {now.notice ? "お知らせを変える" : "お知らせを出す"}
          </Button>
          {now.notice && (
            <Button variant="ghost" size="sm" pending={sending.notice === ""} aria-disabled={noticeBusy || undefined} onClick={() => !noticeBusy && clear()}>
              お知らせを消す
            </Button>
          )}
          <ResultLine result={noticeRes} className="sh-result--side" />
        </div>
      </section>
    </div>
  );
}
