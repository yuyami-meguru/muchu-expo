"use client";

import { useEffect, useId, useRef, useTransition, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Icon, type IconName } from "@/components/icons";
import { Button, type ButtonSize, type ButtonVariant } from "./button";

/**
 * 確認の小窓（60:87）。消す・取り消す・止める・まとめて送る の前だけに出す。
 * パソコンは真ん中、スマホは下から出る。やめるは左、赤いボタンは右（スマホは赤が上）。
 * Esc キーとうしろを押したときは閉じる（何もしない）。
 *
 * 使い方は 3 つ：
 *   1. triggerLabel を渡す → そのボタンを押すと開く
 *   2. open / onOpenChange で外から開け閉めする
 *   3. action（サーバーの処理）か onConfirm（画面の中の処理）で、決めたときの動きを渡す
 */
export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  cancelLabel = "やめる",
  tone = "danger",
  icon,
  onConfirm,
  action,
  fields,
  triggerLabel,
  triggerVariant = "danger",
  triggerSize = "md",
  triggerIcon,
  triggerBlock,
  open,
  onOpenChange,
}: {
  title: string;
  /** 何が起きるかの説明（だれに届くか・元に戻せるか） */
  children?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /** danger＝赤いボタン（消す・取り消す）、primary＝青（まとめて送る など） */
  tone?: "danger" | "primary";
  icon?: IconName;
  onConfirm?: () => void | Promise<void>;
  /** フォームで送る処理（サーバーの処理）。fields はいっしょに送る隠れた値 */
  action?: (formData: FormData) => void | Promise<void>;
  fields?: Record<string, string>;
  triggerLabel?: string;
  triggerVariant?: ButtonVariant;
  triggerSize?: ButtonSize;
  triggerIcon?: IconName;
  triggerBlock?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [pending, startTransition] = useTransition();
  const titleId = useId();

  // 外から開け閉めするとき
  useEffect(() => {
    const d = ref.current;
    if (!d || open === undefined) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const close = () => ref.current?.close();

  const confirmVariant: ButtonVariant = tone === "danger" ? "danger" : "primary";
  const markIcon: IconName = icon ?? (tone === "danger" ? "注意" : "情報");

  return (
    <>
      {triggerLabel && (
        <Button variant={triggerVariant} size={triggerSize} icon={triggerIcon} block={triggerBlock} onClick={() => ref.current?.showModal()} aria-haspopup="dialog">
          {triggerLabel}
        </Button>
      )}
      <dialog
        ref={ref}
        className="ui-dialog"
        aria-labelledby={titleId}
        onClose={() => onOpenChange?.(false)}
        onClick={(e) => {
          // うしろ（小窓の外）を押したら閉じる
          if (e.target === e.currentTarget) close();
        }}
      >
        <div className="ui-dialog-inner">
          <span className="ui-dialog-grip" aria-hidden="true" />
          <div className="ui-dialog-head">
            <span className={tone === "danger" ? "ui-dialog-mark" : "ui-dialog-mark ui-dialog-mark--primary"} aria-hidden="true">
              <Icon name={markIcon} size={20} />
            </span>
            <h2 className="ui-dialog-title" id={titleId}>
              {title}
            </h2>
          </div>
          {children && <div className="ui-dialog-body">{children}</div>}
          {action ? (
            <form
              className="ui-dialog-actions"
              action={async (fd) => {
                await action(fd);
                close();
              }}
            >
              {fields && Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
              <Button variant="secondary" onClick={close} autoFocus>
                {cancelLabel}
              </Button>
              <SubmitButton variant={confirmVariant}>{confirmLabel}</SubmitButton>
            </form>
          ) : (
            <div className="ui-dialog-actions">
              <Button variant="secondary" onClick={close} autoFocus disabled={pending}>
                {cancelLabel}
              </Button>
              <Button
                variant={confirmVariant}
                pending={pending}
                onClick={() =>
                  startTransition(async () => {
                    await onConfirm?.();
                    close();
                  })
                }
              >
                {confirmLabel}
              </Button>
            </div>
          )}
        </div>
      </dialog>
    </>
  );
}

function SubmitButton({ variant, children }: { variant: ButtonVariant; children: ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} pending={pending}>
      {children}
    </Button>
  );
}
