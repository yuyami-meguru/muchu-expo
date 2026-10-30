/*
 * 夢中万博のサービスワーカー（電波が弱いときの備え）。ライブラリなしの手書き。
 * 版（キャッシュの名前）は登録するときの URL の ?v= で受け取る（例 /sw.js?v=0.7.0-abc1234）。
 * 版が変わると URL が変わるので、新しいサービスワーカーに入れかわり、古い保存分は消える。
 *
 * きまり
 *  - お客さん側のページ：通信を先に。失敗したら前に保存したもの。一度も開いていなければ /offline.html
 *  - /_next/static・フォント・/brand・/img・アイコン：保存分を先に（なければ取りに行って保存）
 *  - /api/status：通信を先に。失敗したら最後に保存したもの
 *  - 従業員側（/staff・/join）、/api/staff、/api/survey、/api/radio、POST などの書き込み：さわらない（そのまま通す）
 */
const VERSION = new URL(self.location.href).searchParams.get("v") || "dev";
const PAGES = `muchu-pages-${VERSION}`;
const ASSETS = `muchu-assets-${VERSION}`;
const OFFLINE_URL = "/offline.html";

// お客さん側のページ（保存してよいもの）
const PUBLIC_PAGE = /^\/(|shops(\/[a-z0-9-]+)?|schedule|map|info|survey|radio|award)$/;
// 保存分を先に使うもの（中身が変わらない・名前に版が入っている）
const ASSET = /^\/(_next\/static\/|brand\/|img\/|icon\.svg|apple-icon|favicon|opengraph-image|manifest\.webmanifest)/;
// 絶対にさわらないもの
const NEVER = /^\/(staff|join|api\/staff|api\/survey|api\/radio)(\/|$|\?)/;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(PAGES)
      .then((c) => c.add(new Request(OFFLINE_URL, { cache: "reload" })))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("muchu-") && k !== PAGES && k !== ASSETS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (NEVER.test(url.pathname)) return;

  // 画面の切りかえ（RSC）の読み込みはさわらない。ページそのものの読み込みだけ扱う
  if (req.headers.get("RSC") || url.searchParams.has("_rsc")) return;

  if (ASSET.test(url.pathname)) {
    event.respondWith(cacheFirst(req));
    return;
  }
  if (url.pathname === "/api/status") {
    event.respondWith(networkFirst(req, PAGES, null));
    return;
  }
  if (req.mode === "navigate" && PUBLIC_PAGE.test(url.pathname)) {
    event.respondWith(networkFirst(req, PAGES, OFFLINE_URL));
    return;
  }
  if (req.mode === "navigate") {
    // ほかのページ（見つからないページなど）は、通信できないときだけ「つながりません」
    event.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL)));
  }
});

async function cacheFirst(req) {
  const hit = await caches.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) {
    const c = await caches.open(ASSETS);
    c.put(req, res.clone());
  }
  return res;
}

async function networkFirst(req, cacheName, fallbackUrl) {
  try {
    const res = await fetch(req);
    if (res.ok) {
      const c = await caches.open(cacheName);
      // ?v= などの付いたアドレスも、同じページとして 1 つにまとめて保存する
      c.put(stripSearch(req), res.clone());
    }
    return res;
  } catch {
    const hit = await caches.match(stripSearch(req));
    if (hit) return hit;
    if (fallbackUrl) {
      const off = await caches.match(fallbackUrl);
      if (off) return off;
    }
    return new Response("", { status: 503, statusText: "offline" });
  }
}

function stripSearch(req) {
  const u = new URL(req.url);
  u.search = "";
  return new Request(u.toString(), { headers: req.headers });
}
