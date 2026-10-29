# エンカレ夢中万博 サイト

2026年11月28日（土）の「エンカレ夢中万博」の公式サイト。AVERIX ハブと同じ作り（Next.js ＋ Vercel）で、
**お客さん側**と**従業員側（お店の人・実行委員）**に分かれている。

| 区画 | URL | だれが | できること |
|---|---|---|---|
| お客さん側 | `/` `/shops` `/shops/[id]` `/map` `/info` | だれでも | いまの売り切れ・お知らせ（15 秒ごとに自動更新）、お店のメニュー・値段・当日の流れ・お店の思い、部門の地図 |
| お店の人 | `/join`（お店の QR）→ `/staff` | 各お店 | 自分のお店の「品物ごとの売り切れ」「営業中など」「お店からのお知らせ」だけ |
| 実行委員・先生 | `/staff/login`（合言葉）→ `/staff` | 実行委員 | 全部のお店の編集、地図のピン、トップのお知らせ、お店の QR の印刷・作り直し |

ほかのお店を書き換えようとするとサーバーで断る（`npm run check:auth` で 21 項目を確かめる）。

## フォルダ
- `src/app/(public)/` お客さん側の画面　`src/app/staff/` `src/app/join/` 従業員側の画面　`src/app/api/` 保存の窓口
- `src/components/ui` `src/components/shell` … AVERIX ハブから持ってきた部品と枠（色だけ `src/app/globals.css` で夢中万博に）
- `src/lib/store.ts` 保存先（本番は Upstash Redis、手元は `.data/dev.json`）　`src/lib/auth.ts` ログイン　`src/lib/seed.ts` はじめのデータ
- `src/components/map/school-map.tsx` 地図（いまは**仮の配置図**。校舎の配置図をもらったら差しかえる）
- `docs/` … GitHub Pages の静的ページ（v0.2.0）。パンフの QR（`docs/print/qr.svg`）は `https://yuyami-meguru.github.io/muchu-expo/` を指していて、Vercel の URL が決まったらここから転送する

## 手元で動かす
```
npm install
npm run dev          # http://localhost:3470 （合言葉は dev-pass）
npm run check:auth   # 動かしたまま別の窓で。守りの確認
```
お店の QR は、実行委員でログインして「お店の QR」から。

## 公開のしかた
`docs/SETUP-VERCEL.md`

## 版を上げたら
`package.json` の version・`CHANGELOG.md`・タグ `v○.○.○` をそろえる（画面のいちばん下と従業員側のメニューの下に出る）。

## 「準備中」になっている所（実行委員の画面で埋める）
- 茶屋・地域部門の場所、唐揚げや射的の値段、各お店の当日の流れと「お店の思い」
- 地域部門の企画内容、ラジオ生放送の時刻
- 駐車場、バス・電車での行き方、住所の番地（検索では「安佐南区伴北六丁目」まで）
- 校舎の配置図（地図の差しかえ）

## 載せる前に確かめたいこと
入場料・支払い方法、写真撮影のルール、雨の日の扱い、問い合わせ先。生徒・先生の名前は載せない（未成年の情報のため）。
