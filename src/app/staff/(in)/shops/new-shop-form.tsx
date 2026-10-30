"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, TextField } from "@/components/ui/field";
import type { Dept } from "@/lib/types";
import { send, slug } from "../../_lib/client";

/** いまあるお店の英字の名前（「いまの様子」の窓口から読む。読めなければ空） */
async function shopIds(): Promise<string[]> {
  try {
    const res = await fetch("/api/staff/live", { credentials: "same-origin", cache: "no-store" });
    const json = (await res.json()) as { ok?: boolean; shops?: Record<string, unknown> };
    return json.ok && json.shops ? Object.keys(json.shops) : [];
  } catch {
    return [];
  }
}

/** 自動の英字の名前の番号（shop-10 など）。いまあるお店の数と、shop-○ の番号のうち大きいほうの次 */
function nextNumber(ids: string[]) {
  const nums = ids.map((x) => /^shop-(\d+)$/.exec(x)?.[1]).filter(Boolean).map(Number);
  return Math.max(ids.length, ...nums) + 1;
}

/** お店を足す。足したお店は「非表示」で始まり、中身を入れてから公開する。英字の名前は空なら自動で付ける */
export function NewShopForm({ depts }: { depts: Dept[] }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const name = String(f.get("name") ?? "").trim();
    const dept = String(f.get("dept") ?? "");
    if (!name) return setError("お店の名前を入れてください");
    // 自分で入れた英字の名前（日本語などで使えなければ、止めずに自動の名前にする）
    const typed = slug(String(f.get("id") ?? ""));
    setPending(true);
    setError("");
    let n = typed ? 0 : nextNumber(await shopIds());
    for (let tries = 0; tries < 20; tries++) {
      const id = typed || `shop-${n}`;
      const r = await send("/api/staff/shops", "POST", { id, name, dept });
      if (r.ok) {
        router.push(`/staff/shops/${id}`);
        return;
      }
      // 自動の名前がほかのお店と重なったら（同じころほかの人が足したなど）、次の番号でもう一度
      if (!typed && r.error.includes("もう使われています")) {
        n++;
        continue;
      }
      setPending(false);
      return setError(typed && r.error.includes("もう使われています") ? "その英字の名前はもう使われています。空にすると自動で付けます" : r.error);
    }
    setPending(false);
    setError("英字の名前を自動で付けられませんでした。「アドレスの英字」に入れてください");
  }
  return (
    <Card title="お店を足す">
      <form onSubmit={submit} noValidate className="st-form-grid">
        <TextField label="お店の名前" name="name" maxLength={40} placeholder="例：わたあめ" />
        <Select label="部門" name="dept" defaultValue={depts[0]?.id} options={depts.map((d) => ({ value: d.id, label: d.name }))} hint={depts.length ? undefined : "先に「部門を編集」で部門を作ってください"} />
        <details className="st-span2 st-more-opt">
          <summary>アドレスの英字（空でよい・自動で付けます）</summary>
          <TextField
            label="アドレスの英字"
            name="id"
            maxLength={40}
            placeholder="例：wataame"
            hint="お客さんのページのアドレス（/shops/○○）になります。a〜z・数字・- だけ。あとで変えられません。空なら shop-10 のように自動で付けます"
          />
        </details>
        <div className="st-span2">
          {error && <p className="st-err" role="alert">{error}</p>}
          <Button type="submit" variant="primary" icon="足す" pending={pending}>
            足す（はじめは非表示）
          </Button>
        </div>
      </form>
    </Card>
  );
}
