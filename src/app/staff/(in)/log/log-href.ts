/** 変更の記録の URL（見方・お店・日付をそろえて）。画面とサーバーの両方で使う */
export function logHref(p: { view: string; shop?: string; day?: string }) {
  const q = new URLSearchParams({ view: p.view });
  if (p.shop) q.set("shop", p.shop);
  if (p.day) q.set("day", p.day);
  return `/staff/log?${q.toString()}`;
}
