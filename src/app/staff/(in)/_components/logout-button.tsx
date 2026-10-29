"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { send } from "../../_lib/client";

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <Button
      variant="ghost"
      icon="ログアウト"
      pending={pending}
      onClick={async () => {
        setPending(true);
        await send("/api/staff/logout", "POST");
        router.replace("/staff/login");
        router.refresh();
      }}
    >
      ログアウト
    </Button>
  );
}
