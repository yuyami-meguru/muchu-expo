import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { Icon } from "@/components/icons";
import { cx } from "./cx";

/* 入力の部品。どれも本物の input・select・textarea に label を付けたもの。
   ラベルは上、補足とエラーは下（エラーのときは補足の代わりに、どう直せばいいかを書く）。 */

type FieldBase = {
  label: ReactNode;
  /** 入れ方の補足（例：「LINE の名前と違ってもかまいません」） */
  hint?: ReactNode;
  /** どう直せばいいか（例：「7 けたで入れてください（例：732-0052）」） */
  error?: ReactNode;
  /** 「なくても可」と出す */
  optional?: boolean;
  className?: string;
};

function useFieldIds(id: string | undefined, hint: ReactNode, error: ReactNode) {
  const auto = useId();
  const inputId = id ?? `f${auto}`;
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;
  const describedBy = error ? errorId : hint ? hintId : undefined;
  return { inputId, hintId, errorId, describedBy };
}

function FieldFoot({ hint, error, hintId, errorId }: { hint?: ReactNode; error?: ReactNode; hintId: string; errorId: string }) {
  if (error) {
    return (
      <p className="ui-error" id={errorId}>
        <Icon name="注意" size={14} />
        <span>{error}</span>
      </p>
    );
  }
  if (hint) {
    return (
      <p className="ui-hint" id={hintId}>
        {hint}
      </p>
    );
  }
  return null;
}

function FieldLabel({ htmlFor, label, optional }: { htmlFor: string; label: ReactNode; optional?: boolean }) {
  return (
    <label className="ui-label" htmlFor={htmlFor}>
      {label}
      {optional && <span className="ui-label-opt">なくても可</span>}
    </label>
  );
}

export type TextFieldProps = FieldBase & Omit<InputHTMLAttributes<HTMLInputElement>, "className">;

/** 1 行の入力欄（58:33） */
export function TextField({ label, hint, error, optional, className, id, type = "text", ...rest }: TextFieldProps) {
  const { inputId, hintId, errorId, describedBy } = useFieldIds(id, hint, error);
  return (
    <div className={cx("ui-field", className)}>
      <FieldLabel htmlFor={inputId} label={label} optional={optional} />
      <input
        id={inputId}
        type={type}
        className="ui-input"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...rest}
      />
      <FieldFoot hint={hint} error={error} hintId={hintId} errorId={errorId} />
    </div>
  );
}

export type TextAreaProps = FieldBase & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "className">;

/** 何行も書ける欄 */
export function TextArea({ label, hint, error, optional, className, id, rows = 4, ...rest }: TextAreaProps) {
  const { inputId, hintId, errorId, describedBy } = useFieldIds(id, hint, error);
  return (
    <div className={cx("ui-field", className)}>
      <FieldLabel htmlFor={inputId} label={label} optional={optional} />
      <textarea
        id={inputId}
        rows={rows}
        className="ui-textarea"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...rest}
      />
      <FieldFoot hint={hint} error={error} hintId={hintId} errorId={errorId} />
    </div>
  );
}

export type SelectOption = { value: string; label: string; disabled?: boolean };
export type SelectProps = FieldBase &
  Omit<SelectHTMLAttributes<HTMLSelectElement>, "className"> & {
    options?: SelectOption[];
    /** 何も選んでいないときの文（例：「選んでください」） */
    placeholder?: string;
  };

/** 選ぶ欄（58:46）。5 つ以下ならチップのほうが早い */
export function Select({ label, hint, error, optional, className, id, options, placeholder, children, ...rest }: SelectProps) {
  const { inputId, hintId, errorId, describedBy } = useFieldIds(id, hint, error);
  return (
    <div className={cx("ui-field", className)}>
      <FieldLabel htmlFor={inputId} label={label} optional={optional} />
      <div className="ui-select-wrap">
        <select id={inputId} className="ui-select" aria-invalid={error ? true : undefined} aria-describedby={describedBy} {...rest}>
          {placeholder && <option value="">{placeholder}</option>}
          {options?.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </option>
          ))}
          {children}
        </select>
        <Icon name="下へ" size={20} />
      </div>
      <FieldFoot hint={hint} error={error} hintId={hintId} errorId={errorId} />
    </div>
  );
}

/** チップ 1 つ（59:66）。中身は本物の radio か checkbox */
export function Chip({
  label,
  type = "checkbox",
  className,
  ...rest
}: { label: ReactNode; type?: "checkbox" | "radio"; className?: string } & Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "className">) {
  return (
    <label className={cx("ui-chip", className)}>
      <input type={type} className="ui-chip-input" {...rest} />
      <span className="ui-chip-face">
        <Icon name="チェック" size={16} />
        {label}
      </span>
    </label>
  );
}

export type ChipOption = { value: string; label: string; disabled?: boolean };

/** チップのまとまり。type="radio" で 1 つだけ、"checkbox" でいくつでも選べる */
export function ChipGroup({
  legend,
  name,
  options,
  type = "radio",
  defaultValue,
  hideLegend,
  className,
}: {
  legend: string;
  name: string;
  options: ChipOption[];
  type?: "radio" | "checkbox";
  /** はじめに選んでおくもの（radio は 1 つ、checkbox はいくつでも） */
  defaultValue?: string | string[];
  /** 見出しを画面に出さない（読み上げには残す） */
  hideLegend?: boolean;
  className?: string;
}) {
  const selected = Array.isArray(defaultValue) ? defaultValue : defaultValue ? [defaultValue] : [];
  return (
    <fieldset className={cx("ui-chips", className)}>
      <legend className={hideLegend ? "sr-only" : "ui-label"}>{legend}</legend>
      {options.map((o) => (
        <Chip key={o.value} type={type} name={name} value={o.value} label={o.label} disabled={o.disabled} defaultChecked={selected.includes(o.value)} />
      ))}
    </fieldset>
  );
}

/** チェック（59:77）。文字を押しても切りかわる */
export function Checkbox({
  label,
  hint,
  className,
  ...rest
}: { label: ReactNode; hint?: ReactNode; className?: string } & Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "className">) {
  return (
    <label className={cx("ui-check", className)}>
      <input type="checkbox" className="ui-check-input" {...rest} />
      <span className="ui-check-box" aria-hidden="true">
        <Icon name="チェック" size={16} strokeWidth={3} />
      </span>
      <span className="ui-check-text">
        <span>{label}</span>
        {hint && <span className="ui-hint">{hint}</span>}
      </span>
    </label>
  );
}

/** スイッチ（59:86）。押した瞬間に保存するもの（公開する・受付中 など）に使う */
export function Switch({
  label,
  hint,
  className,
  ...rest
}: { label: ReactNode; hint?: ReactNode; className?: string } & Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "className" | "role">) {
  return (
    <label className={cx("ui-switch", className)}>
      <span className="ui-switch-text">
        <span>{label}</span>
        {hint && <span className="ui-hint">{hint}</span>}
      </span>
      <input type="checkbox" role="switch" className="ui-switch-input" {...rest} />
      <span className="ui-switch-rail" aria-hidden="true" />
    </label>
  );
}
