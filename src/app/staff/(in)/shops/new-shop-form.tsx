"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Select, TextField } from "@/components/ui/field";
import { KIND_LABEL, type Dept, type Kind, type Shop } from "@/lib/types";
import { send, slug } from "../../_lib/client";
import { noteAuth } from "../_components/session-signal";

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

const KINDS = Object.keys(KIND_LABEL) as Kind[];

/**
 * お店を足す（一覧のいちばん上。ふだんはたたんで［＋ お店を足す］だけ）。足したお店は「非表示」で始まり、中身を入れてから公開する。
 * 「何したい？」の分け方も、ここで選ぶ（食べ物のお店が「見る・聴く」のまま出てしまわないように）。英字の名前は空なら自動で付ける。
 * 足したら、そのお店の編集の画面へ（?added=1 で「足しました。次にすること」を出す）
 */
export function NewShopForm({ depts }: { depts: Dept[] }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [kind, setKind] = useState<Kind | "">("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const name = String(f.get("name") ?? "").trim();
    const dept = String(f.get("dept") ?? "");
    if (!name) return setError("お店の名前を入れてください");
    if (!kind) return setError("「何したい？」の分け方を選んでください（お客さんの一覧で、この分け方でしぼれます）");
    // 自分で入れた英字の名前（日本語などで使えなければ、止めずに自動の名前にする）
    const typed = slug(String(f.get("id") ?? ""));
    setPending(true);
    setError("");
    let n = typed ? 0 : nextNumber(await shopIds());
    for (let tries = 0; tries < 20; tries++) {
      const id = typed || `shop-${n}`;
      const r = noteAuth(await send<{ shop: Shop }>("/api/staff/shops", "POST", { id, name, dept, kind }));
      if (r.ok) {
        // 分け方を受け取らない窓口だったとき（はじめは「見る・聴く」で作られる）は、続けて分け方だけ直す
        if (r.shop && r.shop.kind !== kind) await send(`/api/staff/shops/${id}`, "PATCH", { kind });
        router.push(`/staff/shops/${id}?added=1`);
        return;
      }
      // 自動の名前がほかのお店と重なったら（同じころほかの人が足したなど）、次の番号でもう一度
      if (!typed && r.error.includes("もう使われています")) {
        n++;
        continue;
      }
      setPending(false);
      if (r.unsure) return setError("返事が来ませんでした。足せているかもしれないので、画面を読み込み直して、一覧にあるか確かめてください");
      return setError(typed && r.error.includes("もう使われています") ? "その英字の名前はもう使われています。空にすると自動で付けます" : r.error);
    }
    setPending(false);
    setError("英字の名前を自動で付けられませんでした。「アドレスの英字」に入れてください");
  }
  return (
    <details className="st-new" id="new-shop">
      <summary className="st-new-sum">
        <span className="st-new-plus" aria-hidden="true">
          ＋
        </span>
        お店を足す
      </summary>
      <form onSubmit={submit} noValidate className="st-form-grid st-new-body">
        <TextField label="お店の名前" name="name" maxLength={40} placeholder="例：わたあめ" />
        <Select label="部門" name="dept" defaultValue={depts[0]?.id} options={depts.map((d) => ({ value: d.id, label: d.name }))} hint={depts.length ? undefined : "先に「部門を編集」で部門を作ってください"} />
        <Select
          label="「何したい？」の分け方"
          value={kind}
          onChange={(e) => setKind(e.target.value as Kind)}
          placeholder="選んでください"
          options={KINDS.map((k) => ({ value: k, label: KIND_LABEL[k] }))}
          hint="お客さんの一覧の「何したい？」でしぼるときの分け方です。食べ物・飲み物を売るなら「食べる・飲む」"
        />
        <details className="st-more-opt">
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
          {error && (
            <p className="st-err" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" variant="primary" icon="足す" pending={pending}>
            足す（はじめは非表示）
          </Button>
        </div>
      </form>
    </details>
  );
}
