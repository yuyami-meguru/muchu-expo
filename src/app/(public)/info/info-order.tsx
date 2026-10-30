"use client";

import { Fragment, type ReactNode } from "react";
import { usePhase } from "@/components/live/live-provider";
import { isDay } from "../_components/in-phase";

/**
 * ご来場の方へのならび。ふだんは来る前に読む順（行き方 → 困ったときは → ご来場の前に）。
 * 当日（朝・開催中）は会場にいる人が多いので「困ったときは」をいちばん上に（時期は「いまの様子」で決める。設定を読み直さない）
 */
export function InfoOrder({ access, help, notes }: { access: ReactNode; help: ReactNode; notes: ReactNode }) {
  const order: [string, ReactNode][] = isDay(usePhase())
    ? [
        ["help", help],
        ["access", access],
        ["notes", notes],
      ]
    : [
        ["access", access],
        ["help", help],
        ["notes", notes],
      ];
  return order.map(([k, node]) => <Fragment key={k}>{node}</Fragment>);
}
