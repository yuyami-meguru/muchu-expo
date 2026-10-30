"use client";

import { Button } from "@/components/ui/button";
import { cx } from "@/components/ui/cx";
import { clock, NO_SIGNAL_ERROR } from "../../_lib/client";

/*
 * お店の人の画面で「押した結果」を、押した所のすぐ下に出す部品。
 * 場所は先に空けておく（結果が出ても、下のボタンがずれて押しまちがえないように）。
 */

/** 押した結果。value は押した値（いまの値と同じあいだだけ「✓ …しました」を出す）。retry があれば［もう一度］を出す */
export type Result = { ok: boolean; text: string; value?: string; retry?: () => void };

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

/** 表（key → 値）から 1 つ外す */
export function without<T>(m: Record<string, T>, key: string): Record<string, T> {
  return Object.fromEntries(Object.entries(m).filter(([k]) => k !== key));
}

/** いまの値と比べて、出す結果だけを返す（成功は同じ値のあいだだけ。失敗は、ほかの人がその値にしたら消す） */
export function visible(r: Result | undefined, current: string): Result | undefined {
  if (!r) return undefined;
  if (r.ok) return r.value === undefined || r.value === current ? r : undefined;
  return r.value === undefined || r.value !== current ? r : undefined;
}

/** 結果の行（成功は緑の文、失敗は赤い文と［もう一度］。again={false} なら［もう一度］は出さない：押したボタンのほうに出すとき） */
export function ResultLine({ result, again = true, className }: { result?: Result; again?: boolean; className?: string }) {
  return (
    <div className={cx("sh-result", result && !result.ok && "sh-result--ng", className)} role="status">
      {result &&
        (result.ok ? (
          <p className="sh-result-ok">{result.text}</p>
        ) : (
          <>
            <p className="sh-result-ng">{result.text}</p>
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
