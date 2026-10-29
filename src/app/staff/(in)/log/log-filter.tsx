"use client";

import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/field";

/** お店で絞る（選ぶとすぐ切りかわる） */
export function LogFilter({ shops, value }: { shops: { id: string; name: string }[]; value: string }) {
  const router = useRouter();
  return (
    <div className="st-log-filter">
      <Select
        label="お店で絞る"
        value={value}
        onChange={(e) => router.push(e.target.value ? `/staff/log?shop=${encodeURIComponent(e.target.value)}` : "/staff/log")}
        options={[{ value: "", label: "すべてのお店" }, ...shops.map((s) => ({ value: s.id, label: s.name }))]}
      />
    </div>
  );
}
