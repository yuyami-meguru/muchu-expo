/*
 * 夢中万博のサービスワーカー（電波が弱いときの備え）。ライブラリなしの手書き。
 * 版（キャッシュの名前）は登録するときの URL の ?v= で受け取る（例 /sw.js?v=0.7.0-abc1234）。
 * 版が変わると URL が変わるので、新しいサービスワーカーに入れかわり、古いページの保存分は消える。
 * /_next/static などのファイルは名前に中身の印が入っているので、版をまたいで 1 つの保存先に残す
 * （開いたままの古いページが、電波のない所で古いファイルを探しても見つかるように）。
 *
 * きまり
 *  - お客さん側のページ：通信を先に。4 秒待っても返事がない・サーバーの不具合（5xx）なら、前に保存したもの。
 *    一度も開いていなければ /offline.html
 *  - /_next/static・フォント・/brand・/img・アイコン：保存分を先に（なければ取りに行って保存）
 *  - /api/status：通信を先に。3 秒待っても返事がない・5xx なら、最後に保存したもの
 *  - 従業員側（/staff・/join）のページ：保存しない。通信できないときだけ /offline-staff.html（何をすればよいかの案内）
 *  - /api/staff、/api/survey、/api/radio、POST などの書き込み：さわらない（そのまま通す）
 *  - 入れたとき：下のタブの 5 ページを先に保存（開いたことがなくても、電波のない所で見られるように）
 *  - 画面の中で移ったページ（RSC）はページそのものが保存されないので、画面（sw-register.tsx）から URL を受け取って保存する
 */
const VERSION = new URL(self.location.href).searchParams.get("v") || "dev";
const PAGES = `muchu-pages-${VERSION}`;
const ASSETS = "muchu-assets";
const OFFLINE_URL = "/offline.html";
const OFFLINE_STAFF_URL = "/offline-staff.html";

// お客さん側のページ（保存してよいもの）
const PUBLIC_PAGE = /^\/(|shops(\/[a-z0-9-]+)?|schedule|map|info|survey|radio|award)$/;
// 保存分を先に使うもの（中身が変わらない・名前に版が入っている）
const ASSET = /^\/(_next\/static\/|brand\/|img\/|icon\.svg|apple-icon|favicon|opengraph-image|manifest\.webmanifest)/;
// 従業員側のページ（保存しない。つながらないときの案内だけ）
const STAFF_PAGE = /^\/(staff|join)(\/|$)/;
// 絶対にさわらないもの
const NEVER = /^\/(api\/staff|api\/survey|api\/radio)(\/|$|\?)/;
// 下のタブのページ（入れたときに先に保存する）
const TAB_PAGES = ["/", "/shops", "/schedule", "/map", "/info"];
// 画面から頼まれたページは、保存がこれより新しければ取りに行かない（人が多い日に、同じページを何度もサーバーへ取りに行かないように）
const KEEP_FRESH_MS = 10 * 60 * 1000;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(PAGES)
      .then((c) =>
        c
          .addAll([new Request(OFFLINE_URL, { cache: "reload" }), new Request(OFFLINE_STAFF_URL, { cache: "reload" })])
          // 1 つ取れなくても止めない（入れかわりは続ける）
          .then(() => Promise.allSettled(TAB_PAGES.map((p) => keepPage(c, p)))),
      )
      .then(() => self.skipWaiting()),
  );
});

// 画面から「いまのページを保存して」と頼まれたとき（sw-register.tsx）
self.addEventListener("message", (event) => {
  const d = event.data;
  if (!d || d.type !== "keep-page" || typeof d.url !== "string") return;
  const url = new URL(d.url, self.location.origin);
  if (url.origin !== self.location.origin || !PUBLIC_PAGE.test(url.pathname)) return;
  event.waitUntil(keepFresh(url.pathname).catch(() => {}));
});

/** ページを取りに行って保存する（保存の名前は ? を付けない URL。通信を先に、の保存と同じ） */
async function keepPage(cache, path) {
  const url = new URL(path, self.location.origin).toString();
  const res = await fetch(new Request(url, { cache: "no-store", credentials: "same-origin" }));
  if (res.ok && !res.redirected) await cache.put(new Request(url), res);
}

/** 保存が無いか古いときだけ取りに行く */
async function keepFresh(path) {
  const c = await caches.open(PAGES);
  const hit = await c.match(new URL(path, self.location.origin).toString());
  const age = hit ? Date.now() - Date.parse(hit.headers.get("date") || "") : Infinity;
  if (age < KEEP_FRESH_MS) return;
  await keepPage(c, path);
}

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("muchu-") && k !== PAGES && k !== ASSETS).map((k) => caches.delete(k))))
      // v0.9 までは版ごとにファイルの保存先を分けていた（muchu-assets-○○）。上で消える
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

  if (STAFF_PAGE.test(url.pathname)) {
    if (req.mode === "navigate") event.respondWith(fetch(req).catch(() => caches.match(OFFLINE_STAFF_URL)));
    return;
  }

  if (ASSET.test(url.pathname)) {
    event.respondWith(cacheFirst(req));
    return;
  }
  if (url.pathname === "/api/status") {
    event.respondWith(networkFirst(req, PAGES, null, 3000));
    return;
  }
  if (req.mode === "navigate" && PUBLIC_PAGE.test(url.pathname)) {
    event.respondWith(networkFirst(req, PAGES, OFFLINE_URL, 4000));
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

/**
 * 通信を先に。waitMs 待っても返事がない・サーバーの不具合（5xx）のときは、前に保存したものがあればそれを出す。
 * 保存したものが無ければ、通信の返事を待つ（それも失敗したら fallbackUrl）
 */
async function networkFirst(req, cacheName, fallbackUrl, waitMs) {
  const key = stripSearch(req);
  const net = fetch(req).then(async (res) => {
    if (res.ok) {
      const c = await caches.open(cacheName);
      // ?v= などの付いたアドレスも、同じページとして 1 つにまとめて保存する
      await c.put(key, res.clone());
    }
    return res;
  });
  net.catch(() => {});
  try {
    const res = await Promise.race([net, new Promise((done) => setTimeout(() => done(null), waitMs))]);
    if (res && res.status < 500) return res;
    const hit = await caches.match(key);
    if (hit) return hit;
    return res || (await net);
  } catch {
    const hit = await caches.match(key);
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
