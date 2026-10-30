"use client";

import type { ReactNode } from "react";
import { usePhase } from "@/components/live/live-provider";
import type { Phase } from "@/lib/ops";

/** 表示の時期（開催前・当日の朝・開催中・終了後）が only のどれかのときだけ中身を出す */
export function InPhase({ only, children }: { only: Phase[]; children: ReactNode }) {
  return only.includes(usePhase()) ? children : null;
}
