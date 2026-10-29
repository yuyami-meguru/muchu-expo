# 公開のしかた（Vercel ＋ Upstash・どちらも無料）

GitHub のリポジトリ `yuyami-meguru/muchu-expo` を Vercel につなぐ。AVERIX と同じ Vercel のアカウントでよい。
この作業は持ち主（アカウントの人）がする。

1. https://vercel.com/new で `muchu-expo` を Import → そのまま Deploy（はじめは保存先がないので「見るだけ」で動く）
2. できたプロジェクトの **Storage** → **Upstash for Redis**（Marketplace）→ 無料プラン・リージョンは Tokyo（ap-northeast-1）→ このプロジェクトに Connect
   - `KV_REST_API_URL` と `KV_REST_API_TOKEN` が自動で入る
3. **Settings → Environment Variables** に追加（Production）
   - `ADMIN_PASSPHRASE` … 実行委員・先生の合言葉。**12 文字以上**（例：ことば 4 つをつなげる）。LINE のグループには書かず、口頭か紙で
   - `STAFF_SESSION_SECRET` … 長い乱数（ターミナルで `openssl rand -base64 32`）。合言葉を変えても、これがあればログインが切れない
4. **Deployments** → いちばん上の … → Redeploy（変数を読ませるため）
5. 出来た URL（例 `https://muchu-expo.vercel.app`）を開いて、
   - `/staff/login` に合言葉で入れる
   - 「お店の QR」を印刷して各お店に渡す
6. パンフの QR（GitHub Pages）から転送する：`docs/index.html` を転送のページに差しかえる（URL を教えてもらえれば Claude がやる）

## 気をつけること
- お店の QR は**お店の人だけ**に渡す。なくした・知らない人に渡ったら「お店の QR」→「QR を作り直す」（前の QR はすぐ使えなくなる）
- 合言葉を知っている人は、全部のお店を書き換えられる
- Upstash の無料枠は 1 か月 50 万回。お客さんの画面は 15 秒ごとに読み直すが、Vercel が 5 秒ためておくので当日 1 日なら足りる
- Vercel の無料プラン（Hobby）は個人・非営利向け。学校行事の案内なら当てはまる
