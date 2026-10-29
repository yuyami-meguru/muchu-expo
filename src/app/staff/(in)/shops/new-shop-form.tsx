"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, TextField } from "@/components/ui/field";
import { DEPTS, DEPT_ORDER } from "@/lib/types";
import { send, slug } from "../../_lib/client";

/** お店を足す。足したお店は「非公開」で始まり、中身を入れてから公開する */
export function NewShopForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const id = slug(String(f.get("id") ?? ""));
    const name = String(f.get("name") ?? "").trim();
    const dept = String(f.get("dept") ?? "");
    if (!id) return setError("英字の名前（a〜z・数字・-）を入れてください");
    if (!name) return setError("お店の名前を入れてください");
    setPending(true);
    setError("");
    const r = await send("/api/staff/shops", "POST", { id, name, dept });
    setPending(false);
    if (!r.ok) return setError(r.error);
    router.push(`/staff/shops/${id}`);
  }
  return (
    <Card title="お店を足す">
      <form onSubmit={submit} noValidate className="st-form-grid">
        <TextField label="お店の名前" name="name" maxLength={40} placeholder="例：わたあめ" />
        <TextField label="英字の名前（アドレスに使う）" name="id" maxLength={40} placeholder="例：wataame" hint="a〜z・数字・- だけ。あとで変えられません" />
        <Select label="部門" name="dept" defaultValue="chaya" options={DEPT_ORDER.map((d) => ({ value: d, label: DEPTS[d].name }))} />
        <div className="st-span2">
          {error && <p className="st-err" role="alert">{error}</p>}
          <Button type="submit" variant="primary" icon="足す" pending={pending}>
            足す（はじめは非公開）
          </Button>
        </div>
      </form>
    </Card>
  );
}
