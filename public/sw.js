/*
 * 夢中万博のサービスワーカー（電波が弱いときの備え）。ライブラリなしの手書き。
 * 版（キャッシュの名前）は登録するときの URL の ?v= で受け取る（例 /sw.js?v=0.7.0-abc1234）。
 * 版が変わると URL が変わるので、新しいサービスワーカーに入れかわり、古いページの保存分は消える。
 * /_next/static のファイルは名前に中身の印が入っているので、版をまたいで 1 つの保存先に残す
 * （開いたままの古いページが、電波のない所で古いファイルを探しても見つかるように）。
 *
 * きまり
 *  - お客さん側のページ：通信を先に。4 秒待っても返事がない・サーバーの不具合（5xx）なら、前に保存したもの。
 *    保存の名前は ? の中身（area・place・kind だけ）も入れる（/map?area=f3 と /map を別に保存する）。
 *    その名前で保存が無ければ ? なしの保存、それも無ければ /offline.html
 *    /shops/<id> の「見つかりません」（非表示・id のまちがい）と実行委員の下見は、どちらも 200 で本文に noindex の印がある → 保存せず、前の保存分も消す
 *    （あとで表示にしたお店が電波のないときに「見つかりません」のまま出ない・下見のページが同じ端末に残らない・非表示にしたお店の前の保存分を出さない）
 *  - /_next/static：保存分を先に（なければ取りに行って保存。版をまたいで残す）
 *  - /brand・/img・アイコン・manifest：保存分を先に。ただし版ごとの保存先に入れる（同じ名前で差し替えても、次の版で新しくなる）
 *  - /api/status：通信を先に。3 秒待っても返事がない・5xx なら、最後に保存したもの（ヘッダー x-muchu-sw: cache を付ける → 画面は「読めなかった」に数える）
 *  - 従業員側（/staff・/join）のページ：保存しない。通信できないときだけ /offline-staff.html（何をすればよいかの案内）
 *  - /api/staff、/api/survey、/api/radio、POST などの書き込み：さわらない（そのまま通す）
 *  - 入れたとき：電波がないときの案内 2 枚だけを保存する
 *  - 当日（11/28 の朝・開催中）だけ（画面 sw-register.tsx が day: true を付けて頼む）：
 *      画面の中で移ったページ（RSC）はページそのものが保存されないので、画面から URL を受け取って保存する
 *      下のタブの 5 ページを、1 つずつ先に保存する（電波を節約する設定・とても遅い回線のときはしない）
 *    開催前に先に取りに行かないのは、サーバーと Upstash の回数を増やさないため（開いたページは、上のきまりでふつうに保存される）
 */
const VERSION = new URL(self.location.href).searchParams.get("v") || "dev";
const PAGES = `muchu-pages-${VERSION}`;
const ASSETS = "muchu-assets";
const OFFLINE_URL = "/offline.html";
const OFFLINE_STAFF_URL = "/offline-staff.html";

// お客さん側のページ（保存してよいもの）
const PUBLIC_PAGE = /^\/(|shops(\/[a-z0-9-]+)?|schedule|map|info|survey|radio|award)$/;
// ページの保存の名前に入れる ? の中身（ほかの ?（広告の印など）は捨てる）
const PAGE_PARAMS = ["area", "place", "kind"];
// 名前に版の印が入っていて、ずっと変わらないもの（版をまたいで残す）
const STATIC = /^\/_next\/static\//;
// 名前に版の印が無いもの（版ごとの保存先に入れる）
const ASSET = /^\/(brand\/|img\/|icon\.svg|icon\d*|apple-icon|favicon|opengraph-image|manifest\.webmanifest)/;
// 従業員側のページ（保存しない。つながらないときの案内だけ）
const STAFF_PAGE = /^\/(staff|join)(\/|$)/;
// 絶対にさわらないもの
const NEVER = /^\/(api\/staff|api\/survey|api\/radio)(\/|$|\?)/;
// お店のページ（「見つかりません」・下見は保存しない。本文の noindex の印で見分ける）
const SHOP_PAGE = /^\/shops\/[a-z0-9-]+$/;
const NOINDEX = /<meta name="robots" content="[^"]*noindex/i;
// 下のタブのページ（当日に先に保存する）
const TAB_PAGES = ["/", "/shops", "/schedule", "/map", "/info"];
// 保存がこれより新しければ取りに行かない（人が多い日に、同じページを何度もサーバーへ取りに行かないように）
const KEEP_FRESH_MS = 10 * 60 * 1000;
// 開催日（日本時間 11/28）。古い画面は day を付けずに頼んでくるので、そのときはこの日だけ受ける
const DAY_FROM = Date.parse("2026-11-28T00:00:00+09:00");
const DAY_UNTIL = Date.parse("2026-11-28T14:00:00+09:00");

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(PAGES)
      .then((c) => c.addAll([new Request(OFFLINE_URL, { cache: "reload" }), new Request(OFFLINE_STAFF_URL, { cache: "reload" })]))
      // 取れなくても止めない（入れかわりは続ける）
      .catch(() => {})
      .then(() => self.skipWaiting()),
  );
});

/** 電波を節約したい設定・とても遅い回線か（分からなければ節約しない） */
function savingData() {
  const c = self.navigator && self.navigator.connection;
  return !!c && (c.saveData === true || c.effectiveType === "slow-2g" || c.effectiveType === "2g");
}

/** 当日に頼まれたか（新しい画面は day を付ける。付けない古い画面は、開催日の時計で決める） */
function dayAsked(d) {
  if (d.day === true) return true;
  const now = Date.now();
  return now >= DAY_FROM && now < DAY_UNTIL;
}

// 画面からの頼み（sw-register.tsx）
let warming = 0;
self.addEventListener("message", (event) => {
  const d = event.data;
  if (!d || typeof d.type !== "string" || !dayAsked(d)) return;
  if (d.type === "keep-page" && typeof d.url === "string") {
    const url = new URL(d.url, self.location.origin);
    if (url.origin !== self.location.origin || !PUBLIC_PAGE.test(url.pathname)) return;
    event.waitUntil(keepFresh(pageKey(url)).catch(() => {}));
    return;
  }
  // 下のタブのページを 1 つずつ（いっしょに頼まれても、1 度に 1 回だけ走らせる）
  if (d.type === "warm" && !savingData() && Date.now() - warming > KEEP_FRESH_MS) {
    warming = Date.now();
    event.waitUntil(
      TAB_PAGES.reduce((p, path) => p.then(() => keepFresh(pageKey(new URL(path, self.location.origin))).catch(() => {})), Promise.resolve()).finally(() => {
        warming = Date.now();
      }),
    );
  }
});

/** ページの保存の名前（? の中身は area・place・kind だけ、並びをそろえて） */
function pageKey(url) {
  const u = new URL(url.pathname, self.location.origin);
  for (const k of PAGE_PARAMS) {
    const v = url.searchParams.get(k);
    if (v) u.searchParams.set(k, v);
  }
  return u.toString();
}

/**
 * 通信の答えを key の名前で保存する（200 で、回されていないものだけ）。/shops/<id> は本文に noindex の印があれば保存せず、前の保存分も消す。
 * 保存に失敗しても（端末の空きが無いなど）投げない（答えはそのまま画面へ渡す）
 */
async function store(cache, key, res) {
  try {
    if (!res.ok || res.redirected) return;
    if (!SHOP_PAGE.test(new URL(key).pathname)) return await cache.put(key, res.clone());
    const text = await res.clone().text();
    if (NOINDEX.test(text)) return await cache.delete(key);
    await cache.put(key, new Response(text, { status: res.status, statusText: res.statusText, headers: res.headers }));
  } catch {
    // 保存できなくても、ふつうに使える
  }
}

/** ページを取りに行って保存する */
async function keepPage(cache, key) {
  const res = await fetch(new Request(key, { cache: "no-store", credentials: "same-origin" }));
  await store(cache, key, res);
}

/** 保存が無いか古いときだけ取りに行く */
async function keepFresh(key) {
  const c = await caches.open(PAGES);
  const hit = await c.match(key);
  const age = hit ? Date.now() - Date.parse(hit.headers.get("date") || "") : Infinity;
  if (age < KEEP_FRESH_MS) return;
  await keepPage(c, key);
}

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("muchu-") && k !== PAGES && k !== ASSETS).map((k) => caches.delete(k))))
      // v0.9 までは版ごとにファイルの保存先を分けていた（muchu-assets-○○）。上で消える
      // v0.11 までは /brand・/img・アイコンも版をまたぐ保存先に入れていた → 消して、次からは版ごとの保存先に入れる
      .then(() => caches.open(ASSETS))
      .then((c) => c.keys().then((reqs) => Promise.all(reqs.filter((r) => !STATIC.test(new URL(r.url).pathname)).map((r) => c.delete(r)))))
      .catch(() => {})
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

  if (STATIC.test(url.pathname)) {
    event.respondWith(cacheFirst(req, ASSETS));
    return;
  }
  if (ASSET.test(url.pathname)) {
    event.respondWith(cacheFirst(req, PAGES));
    return;
  }
  if (url.pathname === "/api/status") {
    // ? は付けない（? の付いた /api/status はサーバーが ? なしへ回す）
    event.respondWith(networkFirst(req, new URL("/api/status", self.location.origin).toString(), null, null, 3000));
    return;
  }
  if (req.mode === "navigate" && PUBLIC_PAGE.test(url.pathname)) {
    const key = pageKey(url);
    const plain = new URL(url.pathname, self.location.origin).toString();
    event.respondWith(networkFirst(req, key, key === plain ? null : plain, OFFLINE_URL, 4000));
    return;
  }
  if (req.mode === "navigate") {
    // ほかのページ（見つからないページなど）は、通信できないときだけ「つながりません」
    event.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL)));
  }
});

async function cacheFirst(req, cacheName) {
  const c = await caches.open(cacheName);
  const hit = await c.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) c.put(req, res.clone());
  return res;
}

/** 前に保存したものに、印（x-muchu-sw: cache）を付けて返す（画面が「新しく読めた」と取りちがえないように） */
function marked(res) {
  const h = new Headers(res.headers);
  h.set("x-muchu-sw", "cache");
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
}

/** 前に保存したもの（key で無ければ alt で） */
async function saved(cacheName, key, alt) {
  const c = await caches.open(cacheName);
  return (await c.match(key)) || (alt ? await c.match(alt) : undefined);
}

/**
 * 通信を先に。waitMs 待っても返事がない・サーバーの不具合（5xx）のときは、前に保存したものがあればそれを出す。
 * 保存したものが無ければ、通信の返事を待つ（それも失敗したら fallbackUrl）
 */
async function networkFirst(req, key, alt, fallbackUrl, waitMs) {
  const net = fetch(req).then(async (res) => {
    const c = await caches.open(PAGES).catch(() => null);
    if (c) await store(c, key, res);
    return res;
  });
  net.catch(() => {});
  try {
    const res = await Promise.race([net, new Promise((done) => setTimeout(() => done(null), waitMs))]);
    if (res && res.status < 500) return res;
    const hit = await saved(PAGES, key, alt);
    if (hit) return marked(hit);
    return res || (await net);
  } catch {
    const hit = await saved(PAGES, key, alt);
    if (hit) return marked(hit);
    if (fallbackUrl) {
      const off = await caches.match(fallbackUrl);
      if (off) return off;
    }
    return new Response("", { status: 503, statusText: "offline" });
  }
}
