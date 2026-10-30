/** 変更の記録の URL（見方・お店・日付・ページをそろえて）。画面とサーバーの両方で使う。ページは 1 のとき付けない */
export function logHref(p: { view: string; shop?: string; day?: string; page?: number }) {
  const q = new URLSearchParams({ view: p.view });
  if (p.shop) q.set("shop", p.shop);
  if (p.day) q.set("day", p.day);
  if (p.page && p.page > 1) q.set("page", String(p.page));
  return `/staff/log?${q.toString()}`;
}
