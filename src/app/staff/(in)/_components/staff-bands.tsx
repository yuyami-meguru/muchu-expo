"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { PHASE_MODES, type Phase, type PhaseMode } from "@/lib/ops";
import { clock } from "../../_lib/client";
import { LoginForm } from "../../login/login-form";
import { markAlive, useSessionSignal } from "./session-signal";
import "../../login/login.css";

/** お客さんの画面の出し方（phaseOf の答え） */
export const PHASE_LABEL: Record<Phase, string> = { before: "開催前", morning: "当日の朝", during: "開催中", after: "終了後" };
export const modeLabel = (m: PhaseMode) => PHASE_MODES.find((x) => x.value === m)?.label ?? m;

/** ログインの残りがこの分より少なくなったら、上に知らせる */
const SOON_MIN = 60;
const tick = (f: () => void) => {
  const t = setInterval(f, 20_000);
  return () => clearInterval(t);
};

/**
 * 実行委員の全部の画面のいちばん上に出す帯（layout.tsx から）。
 *  1. ログイン：残り 60 分を切ったら黄色、切れたら赤（画面の上に貼りつく）。［合言葉で入り直す］はこの帯の中で入れる（書きかけの入力を消さないため。ページは移らない）
 *  2. 表示の時期：「日時で自動」でないあいだは黄色い帯（練習のあとの戻し忘れに気づけるように）
 * 切れたかどうかは、期限の時刻と、15 秒ごとの読み込み・押した答え（session-signal.ts）の両方で決める。
 */
export function StaffBands({ exp, phase }: { exp: number; phase: { mode: PhaseMode; now: Phase; until: number } }) {
  const router = useRouter();
  const signal = useSessionSignal();
  // 期限までの分（20 秒ごとに見直す。サーバーと最初の描画では null）
  const minutesLeft = useSyncExternalStore(tick, () => Math.ceil((exp - Date.now()) / 60_000), () => null);
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  // 期限を過ぎても、そのあと読み込みが通っていれば（ほかのタブで入り直した）切れていない
  const timeUp = minutesLeft !== null && minutesLeft <= 0 && signal.okAt < exp;
  const expired = signal.expired || timeUp;
  const soon = !expired && minutesLeft !== null && minutesLeft <= SOON_MIN;
  const show = expired || soon || open;

  // 「入り直しました」は少しして消す（この帯はページを移っても残るので）
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setDone(false), 8000);
    return () => clearTimeout(t);
  }, [done]);

  function start() {
    setOpen(true);
    setDone(false);
    // 帯は貼りつけをやめて、ページのいちばん上で開く（入れる欄が画面の外に出ないように）
    requestAnimationFrame(() => {
      box.current?.scrollIntoView({ block: "start" });
      box.current?.querySelector<HTMLInputElement>("input[name=pass]")?.focus({ preventScroll: true });
    });
  }

  return (
    <>
      {show && (
        <div ref={box} className={open ? "st-session st-session--open" : expired ? "st-session st-session--out" : "st-session"}>
          <div className="st-session-row" role={expired ? "alert" : "status"}>
            <Icon name="鍵" size={20} />
            <p className="st-session-text">
              {expired ? (
                <>
                  <b>ログインが切れました。</b>このままでは保存できません
                </>
              ) : minutesLeft !== null && minutesLeft > 0 ? (
                <>
                  <b>ログインは {clock(exp)} に切れます</b>（あと {minutesLeft} 分）
                </>
              ) : (
                <b>合言葉で入り直します</b>
              )}
            </p>
            {!open && (
              <button type="button" className="st-session-btn" onClick={start}>
                {expired ? "合言葉で入り直す" : "いま入り直す"}
              </button>
            )}
          </div>
          {open && (
            <div className="st-session-form">
              <p className="st-session-note">入り直しても、この画面の書きかけは消えません。入ったら、保存できなかったボタンをもう一度押してください。</p>
              <LoginForm
                compact
                onDone={() => {
                  markAlive();
                  setOpen(false);
                  setDone(true);
                  // 枠（期限の時刻）と画面の中身を新しくする。入力中の欄はそのまま
                  router.refresh();
                }}
              />
              <Button variant="ghost" onClick={() => setOpen(false)}>
                あとで
              </Button>
            </div>
          )}
        </div>
      )}
      {done && !show && (
        <p className="st-session-ok" role="status">
          ✓ 入り直しました。もう一度押せば保存できます
        </p>
      )}
      {phase.mode !== "auto" && (
        <div className="st-phase-band" role="status">
          <Icon name="注意" size={20} />
          <p className="st-phase-band-text">
            <b>表示の時期が「{modeLabel(phase.mode)}」のままです</b>
            <span>
              お客さんの画面は、日時に関係なく「{PHASE_LABEL[phase.now]}」の出し方です。練習のあとは「日時で自動」に戻してください
              {phase.until > 0 ? "（24:00 には自動で戻ります）" : ""}
            </span>
          </p>
          <Link href="/staff/tools#phase" className="st-session-btn">
            直す
          </Link>
        </div>
      )}
    </>
  );
}
