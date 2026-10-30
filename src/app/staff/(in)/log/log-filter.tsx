"use client";

import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/field";
import { logHref } from "./log-href";

/** お店・日付で絞る（選ぶとすぐ切りかわる） */
export function LogFilter({
  view,
  shops,
  value,
  days,
  day,
}: {
  view: string;
  shops: { id: string; name: string }[];
  value: string;
  /** 当日の動きのとき：記録のある日（新しい順） */
  days?: { value: string; label: string }[];
  day?: string;
}) {
  const router = useRouter();
  return (
    <div className="st-log-filter">
      <Select
        label="お店で絞る"
        value={value}
        onChange={(e) => router.push(logHref({ view, shop: e.target.value, day }))}
        options={[{ value: "", label: "すべてのお店" }, ...shops.map((s) => ({ value: s.id, label: s.name }))]}
      />
      {days && days.length > 0 && (
        <Select
          label="日にち"
          value={day ?? ""}
          onChange={(e) => router.push(logHref({ view, shop: value, day: e.target.value }))}
          options={[...days, { value: "all", label: "すべての日" }]}
        />
      )}
    </div>
  );
}
