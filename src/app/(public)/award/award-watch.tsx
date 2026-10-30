"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useLive } from "@/components/live/live-provider";

/**
 * /award を開いて発表を待っている人のために、15 秒ごとの「いまの様子」で発表（live.awardOn）を見張る。
 * 発表されたら「発表されました！」を出して、ページを読み直す（取り消されたときも読み直す）。
 * 変わったときだけ読み直す（ページの中身と食いちがっていても、くり返し読み直さない）
 */
export function AwardWatch() {
  const on = useLive().awardOn;
  const router = useRouter();
  const [first] = useState(on);
  const last = useRef(on);
  useEffect(() => {
    if (on === undefined) return;
    if (last.current !== undefined && on !== last.current) router.refresh();
    last.current = on;
  }, [on, router]);
  const flash = first === false && on === true;
  return (
    <div role="status" className="aw-watch">
      {flash && <p className="aw-flash">発表されました！</p>}
    </div>
  );
}
