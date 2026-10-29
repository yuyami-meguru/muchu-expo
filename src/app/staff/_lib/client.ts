"use client";

// 従業員側の画面から API を呼ぶ。失敗したら、サーバーが返した日本語（error）をそのまま返す。
export type SendResult<T = Record<string, unknown>> = ({ ok: true } & T) | { ok: false; error: string };

export async function send<T = Record<string, unknown>>(url: string, method: "POST" | "PATCH" | "PUT" | "DELETE", body?: unknown): Promise<SendResult<T>> {
  try {
    const res = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: "same-origin",
    });
    const json = (await res.json().catch(() => null)) as ({ ok?: boolean; error?: string } & T) | null;
    if (!res.ok || !json?.ok) return { ok: false, error: json?.error ?? `うまくいきませんでした（${res.status}）` };
    return json as { ok: true } & T;
  } catch {
    return { ok: false, error: "通信できませんでした。電波のよい所でもう一度ためしてください" };
  }
}

/** 「保存しました 13:05」 */
export function savedAt() {
  const d = new Date();
  return `保存しました ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** 英字の名前（a-z・0-9・-）に直す */
export function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
}
