"use client";

import { Button } from "@/components/ui/button";
import { cx } from "@/components/ui/cx";
import { clock, NO_SIGNAL_ERROR } from "../../_lib/client";

/*
 * お店の人の画面で「押した結果」を、押した所のすぐ下に出す部品。
 * 場所は先に空けておく（結果が出ても、下のボタンがずれて押しまちがえないように）。
 * 「お店の場所を決める」（places/shop-places.tsx）とログアウトも、Result・visible・failText などを使う（形を変えない）。
 */

/** 返事が来なかったとき（打ち切り）に「届いたか」を確かめている途中の印。seenAt は確かめ始めたときの「いまの様子」の時刻（サーバー） */
export type Check = { seenAt: number; done: boolean; okText: string; ngText: string };

/**
 * 押した結果。value は押した値（いまの値と同じあいだだけ成功の文を出す）。
 * retry があれば［もう一度］、undo があれば［元に戻す］を出す。wait は「確かめています…」（成功でも失敗でもない）。
 * sr は読み上げだけに足す前置き（「バナナジュースを」など。画面は狭いので出さない）
 */
export type Result = { ok: boolean; text: string; value?: string; retry?: () => void; undo?: () => void; wait?: boolean; check?: Check; sr?: string };

/** send() が電波で失敗したか */
export function isNoSignal(error: string) {
  return error === NO_SIGNAL_ERROR;
}

/** 失敗の文：電波なら「〜できませんでした（電波が届いていません）。もう一度押してください」、ほかはサーバーの文をそのまま続ける */
export function failText(head: string, error: string, again = "もう一度押してください") {
  return isNoSignal(error) ? `${head}（電波が届いていません）。${again}` : `${head}。${error}`;
}

/** いまの時刻「13:05」（押した結果に付ける） */
export function nowClock() {
  return clock(Date.now());
}

/** 「売り切れにしました（12:03）」の形（かっこは全角・時の頭に 0 を付けない） */
export function doneText(what: string) {
  return `✓ ${what}（${nowClock()}）`;
}

const DAY = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric" });

/** 同じ日なら「13:05」、ちがう日なら「10/30 13:05」（日本時間）。today は比べる基準の時刻（サーバーの時刻。分からなければ時刻だけ） */
export function stamp(at: number, today: number | null | undefined) {
  return !today || DAY.format(at) === DAY.format(today) ? clock(at) : `${DAY.format(at)} ${clock(at)}`;
}

/** 表（key → 値）から 1 つ外す */
export function without<T>(m: Record<string, T>, key: string): Record<string, T> {
  return Object.fromEntries(Object.entries(m).filter(([k]) => k !== key));
}

/** いまの値と比べて、出す結果だけを返す（成功は同じ値のあいだだけ。失敗は、ほかの人がその値にしたら消す） */
export function visible(r: Result | undefined, current: string): Result | undefined {
  if (!r) return undefined;
  if (r.wait) return r;
  if (r.ok) return r.value === undefined || r.value === current ? r : undefined;
  return r.value === undefined || r.value !== current ? r : undefined;
}

/**
 * 「届いたか確かめています…」の結果を、確かめるための読み直し（使い回しなしの新しい読み）が終わってから決める。
 * そのあいだに来たふだんの読み直しは、サーバーが少し使い回した古い中身のことがあるので、それでは決めない。
 * 読み直せて（liveAt が確かめ始めたときより新しい）押した値になっていれば成功、なっていなければ「届いていませんでした」。
 * 読み直せなければ（電波なし）、確かめられなかったと出す
 */
export function settle(r: Result | undefined, current: string, liveAt: number): Result | undefined {
  if (!r?.check) return r;
  const { check, ...rest } = r;
  if (!check.done) return { ...rest, ok: false, wait: true, text: "返事が来ません。届いたか確かめています…", undo: undefined, retry: undefined };
  if (liveAt > check.seenAt) {
    return current === r.value ? { ...rest, ok: true, wait: false, text: check.okText, retry: undefined } : { ...rest, ok: false, wait: false, text: check.ngText, undo: undefined };
  }
  // 結果の行は 2 行ぶんの場所しか空けていないので、短く（320px・文字を大きくでも 2 行）
  return { ...rest, ok: false, wait: false, text: "確かめられませんでした（電波が届いていません）。もう一度押してください", undo: undefined };
}

/**
 * 結果の行（成功は緑の文と［元に戻す］、失敗は赤い文と［もう一度］、確かめ中は灰色の文）。
 * again={false} なら［もう一度］は出さない（押したボタンのほうに「もう一度」を出すとき）
 */
export function ResultLine({ result, again = true, className }: { result?: Result; again?: boolean; className?: string }) {
  return (
    <div className={cx("sh-result", result && !result.ok && !result.wait && "sh-result--ng", className)} role="status">
      {result &&
        (result.wait ? (
          <p className="sh-result-wait">{result.text}</p>
        ) : result.ok ? (
          <>
            <p className="sh-result-ok">
              {result.sr && <span className="sr-only">{result.sr}</span>}
              {result.text}
            </p>
            {result.undo && (
              <Button size="sm" variant="secondary" className="sh-undo" onClick={result.undo}>
                元に戻す
              </Button>
            )}
          </>
        ) : (
          <>
            <p className="sh-result-ng">
              {result.sr && <span className="sr-only">{result.sr}</span>}
              {result.text}
            </p>
            {again && result.retry && (
              <Button size="sm" variant="danger" onClick={result.retry}>
                もう一度
              </Button>
            )}
          </>
        ))}
    </div>
  );
}
