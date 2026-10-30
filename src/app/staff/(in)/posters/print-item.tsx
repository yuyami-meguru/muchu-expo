import type { ReactNode } from "react";
import { PrintOneButton } from "../qr/qr-tools";

/**
 * 印刷の 1 まい（ポスター 1 枚・フロアの案内 1 枚・控えの紙 1 つ）。画面では上に「○ 枚目」と［この 1 枚だけ印刷］を出す。
 * group は、まとめて印刷するときの組（PrintGroupButton の group と同じ値）
 */
export function PrintItem({
  id,
  label,
  button,
  className,
  group,
  children,
}: {
  id: string;
  label: string;
  button?: string;
  className?: string;
  group?: string;
  children: ReactNode;
}) {
  return (
    <div id={id} className={className ? `pst-item ${className}` : "pst-item"} data-print-unit data-print-group={group}>
      <div className="pst-bar st-noprint">
        <span className="pst-bar-l">{label}</span>
        <PrintOneButton target={id} label={button} />
      </div>
      {children}
    </div>
  );
}
