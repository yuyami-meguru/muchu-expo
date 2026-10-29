import { Icon } from "@/components/icons";
import { cx } from "./cx";

/**
 * 手順（60:46）。申し込みの段階など。
 * current より前は「済み」（緑のチェック）、current は「いま」（青）、後ろは「まだ」。
 */
export function Steps({ steps, current, label = "進み具合", className }: { steps: string[]; current: number; label?: string; className?: string }) {
  return (
    <ol className={cx("ui-steps", className)} aria-label={label}>
      {steps.map((s, i) => {
        const state = i < current ? "done" : i === current ? "current" : "todo";
        return (
          <li key={s} className={cx("ui-step", `ui-step--${state}`)} aria-current={state === "current" ? "step" : undefined}>
            <span className="ui-step-dot" aria-hidden="true">
              {state === "done" ? <Icon name="チェック" size={18} strokeWidth={3} /> : i + 1}
            </span>
            <span className="ui-step-label">
              {s}
              <span className="sr-only">{state === "done" ? "（済み）" : state === "current" ? "（いまここ）" : ""}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
