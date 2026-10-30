"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { boardRowsOf, type BoardNames } from "@/components/live/live-parts";
import { useLive, usePhase } from "@/components/live/live-provider";
import { useEventMinute } from "./clock";
import { isDay } from "./in-phase";
import { nextBusFromSchool } from "./next-bus";

/*
 * ホームの表紙の、表示の時期で変わるところ（時期は「いまの様子」で決める。読み直しのたびに変わる）。
 * 当日（朝・開催中）は表紙を低くして、売り切れ・このあと・次の送迎バスが最初の画面に入るようにする
 */

/** 表紙の枠。当日は低い形（hm-hero--day） */
export function HeroSection({ children }: { children: ReactNode }) {
  const day = isDay(usePhase());
  return <section className={day ? "hm-hero hm-hero--day" : "hm-hero"}>{children}</section>;
}

/**
 * 表紙のボタン。ふだんは［お店・出し物を見る］［行き方・送迎バス］。
 * 当日は［マップ］［このあと］（このあと＝下の「このあと」へ。時刻の決まった予定が無ければ［お店・出し物］）
 */
export function HeroCta({ hasNext }: { hasNext: boolean }) {
  const phase = usePhase();
  if (isDay(phase)) {
    return (
      <p className="hm-cta">
        <Link href="/map" className="hm-btn hm-btn--main">
          <span aria-hidden="true">▶ </span>マップ
        </Link>
        {hasNext ? (
          <a href="#next" className="hm-btn">
            このあと
          </a>
        ) : (
          <Link href="/shops" className="hm-btn">
            お店・出し物
          </Link>
        )}
      </p>
    );
  }
  return (
    <p className="hm-cta">
      <Link href="/shops" className="hm-btn hm-btn--main">
        <span aria-hidden="true">▶ </span>お店・出し物を見る
      </Link>
      <Link href="/info#access" className="hm-btn">
        行き方・送迎バス
      </Link>
    </p>
  );
}

/**
 * 当日だけ、表紙のいちばん下に 1 行：売り切れの数（下の「いまの様子」へ）と、学校発の次の送迎バス（ご来場の方へのバスの時刻へ）。
 * 売り切れは営業中・休憩中のお店の品物だけ数える（「いまの様子」と同じ数え方）
 */
export function DayStrip({ names }: { names: BoardNames }) {
  const live = useLive();
  const phase = usePhase();
  const now = useEventMinute();
  if (!isDay(phase)) return null;
  const out = boardRowsOf(live, names).reduce((n, r) => n + r.out.length, 0);
  const bus = now === null ? null : nextBusFromSchool(now);
  return (
    <p className="hm-strip">
      <a href="#now" className="hm-strip-a">
        <span className="hm-strip-k">売り切れ</span>
        <strong className="keep">{out ? `${out} 件` : "いまはありません"}</strong>
        <span className="hm-strip-go" aria-hidden="true">
          ▼
        </span>
      </a>
      {now !== null && (
        <Link href="/info#bus" className="hm-strip-a">
          <span className="hm-strip-k">次の送迎バス（学校発）</span>
          <strong className={bus ? "nowrap" : "keep"}>{bus ? `${bus} 発` : "すべて出ました"}</strong>
          <span className="hm-strip-go" aria-hidden="true">
            ▶
          </span>
        </Link>
      )}
    </p>
  );
}
