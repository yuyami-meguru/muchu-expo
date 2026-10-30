"use client";

import type { ReactNode } from "react";

/**
 * 一覧をしぼる切り替え（「まだのお店だけ」「未定のお店だけ」）。押すたびにオン・オフ。
 * いましぼっているかは、四角の ✓ と aria-pressed で示す（お客さん側の「これからの予定だけ」と同じ形）
 */
export function OnlyToggle({ on, onChange, children }: { on: boolean; onChange: (on: boolean) => void; children: ReactNode }) {
  return (
    <button type="button" className="st-toggle" aria-pressed={on} onClick={() => onChange(!on)}>
      <span className="st-toggle-box" aria-hidden="true">
        {on ? "✓" : ""}
      </span>
      {children}
    </button>
  );
}
