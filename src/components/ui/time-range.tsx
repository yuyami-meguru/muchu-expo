import { timeParts } from "@/lib/time-text";

/**
 * タイムテーブルの時刻。「10:00〜12:00」は「10:00」と「〜12:00」の 2 行にする（せまい時刻の欄からはみ出して、することの名前に重なったり、
 * 切れたりしないように。2026-11-26 のユーザーの指摘）。区切りは「〜」にそろえる（「11:00-11:10」も「〜11:10」）。
 * 時刻だけでない文（「午前中」など）は、そのまま出す（ふつうに折り返す）
 */
export function TimeRange({ raw, className }: { raw: string; className?: string }) {
  const p = timeParts(raw);
  if (!p) return <span className={className}>{raw}</span>;
  return (
    <span className={className}>
      <span className="tr-from">
        {p.from}
        {p.open ? "〜" : ""}
      </span>
      {p.to && <span className="tr-to">〜{p.to}</span>}
    </span>
  );
}
