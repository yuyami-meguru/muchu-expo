"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Icon } from "@/components/icons";

/**
 * 知らせ（保存しました）。パソコンは右下、スマホは下のメニューの上に 5 秒だけ出す。
 * 取り消せる操作には「元に戻す」を付ける（onUndo か undoAction）。
 * 読み上げは role="status"（話の途中に割りこまない）。
 * マウスを乗せている間・中のボタンを選んでいる間は消えない。
 *
 * もう一度出すときは、親で key を変えて作り直す。
 */
export function Toast({
  message = "保存しました",
  open = true,
  duration = 5000,
  onClose,
  undoLabel = "元に戻す",
  onUndo,
  undoAction,
  action,
  offset,
}: {
  message?: ReactNode;
  open?: boolean;
  /** 出しておく時間（ミリ秒） */
  duration?: number;
  onClose?: () => void;
  undoLabel?: string;
  /** 「元に戻す」を押したとき（画面の中の処理） */
  onUndo?: () => void;
  /** 「元に戻す」を押したとき（サーバーの処理） */
  undoAction?: (formData: FormData) => void | Promise<void>;
  /** 「元に戻す」の代わりに置くもの */
  action?: ReactNode;
  /** スマホで下からどれだけ上げるか（下のメニューの高さ）。px */
  offset?: number;
}) {
  const [dismissed, setDismissed] = useState(false);
  const [paused, setPaused] = useState(false);
  const visible = open && !dismissed;

  useEffect(() => {
    if (!visible || paused || duration <= 0) return;
    const t = setTimeout(() => {
      setDismissed(true);
      onClose?.();
    }, duration);
    return () => clearTimeout(t);
  }, [visible, paused, duration, onClose]);

  const done = () => {
    setDismissed(true);
    onClose?.();
  };

  return (
    <div className="ui-toast-region" role="status" aria-live="polite" style={offset !== undefined ? { ["--toast-offset" as string]: `${offset}px` } : undefined}>
      {visible && (
        <div
          className="ui-toast"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
        >
          <Icon name="完了" size={20} />
          <span className="ui-toast-msg">{message}</span>
          {action}
          {!action && onUndo && (
            <button
              type="button"
              className="ui-toast-action"
              onClick={() => {
                onUndo();
                done();
              }}
            >
              <Icon name="元に戻す" size={16} />
              {undoLabel}
            </button>
          )}
          {!action && !onUndo && undoAction && (
            <form
              action={async (fd) => {
                await undoAction(fd);
                done();
              }}
            >
              <button type="submit" className="ui-toast-action">
                <Icon name="元に戻す" size={16} />
                {undoLabel}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
