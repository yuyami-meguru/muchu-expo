"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { send } from "../_lib/client";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const pass = String(new FormData(e.currentTarget).get("pass") ?? "");
    if (!pass.trim()) return setError("合言葉を入れてください");
    setPending(true);
    const r = await send("/api/staff/login", "POST", { pass });
    if (!r.ok) {
      setPending(false);
      return setError(r.error);
    }
    router.replace("/staff");
    router.refresh();
  }
  return (
    <form onSubmit={submit} noValidate>
      <TextField label="合言葉" name="pass" type="password" autoComplete="current-password" error={error || undefined} required />
      <Button type="submit" variant="primary" size="lg" block pending={pending}>
        ログイン
      </Button>
    </form>
  );
}
