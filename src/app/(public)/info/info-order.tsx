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

const JUMPS = [
  { id: "bus", label: "送迎バスの時刻" },
  { id: "access", label: "行き方" },
  { id: "help", label: "困ったときは" },
  { id: "before", label: "ご来場の前に" },
];

/** ページの中の案内（上の札）。並びは本文と同じにする（当日は「困ったときは」を先頭に） */
export function InfoJump() {
  const day = isDay(usePhase());
  const list = day ? [JUMPS[2], JUMPS[0], JUMPS[1], JUMPS[3]] : JUMPS;
  return (
    <nav className="if-jump" aria-label="このページの中">
      {list.map((j) => (
        <a key={j.id} href={`#${j.id}`}>
          {j.label}
        </a>
      ))}
    </nav>
  );
}
