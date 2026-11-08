# VRC Men's Catalog

VRChat向けの男性アバターを選び、そのアバターの対応衣装・小物を探す日本語カタログのコードです。TypeScript / Cloudflare Workers Static Assets / D1。商品情報はBOOTHの公開ページから取得し、本体・共通素体・対応関係を根拠つきで保存します。

## 現在の状態

- このリポジトリは公開コードリポジトリです。データ(`data/`)、状態、秘密情報はGit除外で、含まれません。
- サイトはCloudflareへ**未デプロイ**です。ローカル(`npm run dev`、http://localhost:8787)で動作します。Cloudflare上での配置・D1 remote・WorkersからのBOOTH取得は未検証です。
- 運用中なのは、ConoHa VPS上の日次収集(`vrc-mens-daily.timer`、`deploy/vps/`)です。初回の全件クロールは2026-10-14に完了済みで、常駐の `vrc-mens-collector.service` は2026-11-08にVPS上で停止(disable)されています。VPSの差分をローカルへ取り込む同期は手動です。詳細は [VPS運用](docs/vps-collector-operations.md)。
- フロントエンド、ローカルD1、手動補正はWindows側にあります。

## 構成

| 場所 | 内容 |
|---|---|
| `src/shared` | HTML解析、正規化、取得制限、モデル、SQL生成 |
| `src/cli` | ファイル保存・再開・反映アダプターとCLI(`npm run cli -- <command>`) |
| `src/worker` | D1とHTTPのWorkerアダプター |
| `public` | 依存の少ないレスポンシブ日本語UI |
| `config` | アバター定義、収集設定、レビュー済み補正、分類 |
| `migrations` | D1マイグレーション |
| `deploy/vps` | VPS側の収集コード(Python)、解析バンドルのビルド、systemd unit、`install.sh` |
| `scripts` | 補助スクリプト。一覧は [scripts/README.md](scripts/README.md) |
| `tests` | Node testとUI検証(`ui.mjs`) |
| `docs` | 収集記録、調査、VPS運用。旧READMEは [docs/readme-history-2026-10.md](docs/readme-history-2026-10.md) |

## ローカル起動

Node.js 22以上(`package.json` の `engines` に従う)、npm。Windows向けスクリプトにはPowerShellを使用します。

```powershell
npm ci
npm run db:migrate
# data/catalog.json と保存HTMLが必要(下記の収集で作成)
npm run db:seed
npm run dev
```

D1のローカルDBは `.wrangler/state` に保存されます。`db:seed` は `data/catalog.json` からSQLを書き出し、ローカルD1へUPSERTします。環境変数の例は `.env.example`(VPS操作スクリプトを使う場合は `VPS_*` の実値が必要)。

## データ収集

収集はCLIで行います。初回は `data/` が空なので、まず収集します。

```powershell
npm run cli -- initial        # 初回取得(config/crawl.json)
npm run cli -- review         # 取得結果の確認
npm run cli -- override config/reviewed.json
npm run db:seed
npm run cli -- daily          # 日次差分取得
npm run cli -- retry          # 失敗商品の再試行
npm run cli -- parse-saved    # 保存済みHTMLだけを再解析(外部アクセスなし)
```

その他のコマンドは `npm run cli -- help` を参照してください。計画収集(`plan` / `collect-plan` / `plan-refresh`)、限定取得(`collect-gaps`)、保存済み作者概要からの抽出(`extract-description-avatars`)などがあります。それぞれの実行記録は `docs/` にあります。

取得の安全設定: 逐次取得(concurrency=1)、間隔3000ms(1000ms未満は拒否)、1日30リクエスト(500以下に制限)、再試行最大2回、タイムアウト20秒、robotsを取得して対象パスを確認。403/401、確認画面、リダイレクトは停止し、回避はしません。429はRetry-Afterを尊重します。ローカル収集は `data/vps-migration-active.json` がある間は起動を拒否します。上限停止は終了コード2、エラーは1、正常は0。

- 取得・解析と公開レビューは別段階です。対応の根拠を確認して補正を登録するまで、候補は公開しません。
- 404・取得失敗・解析失敗でも保存済み商品は消しません。
- 補正は元データを上書きせず、独立テーブルに保存します。

収集の詳細な仕様と過去の実行結果は [docs/readme-history-2026-10.md](docs/readme-history-2026-10.md) と各 `docs/` の記録にあります。

## VPSでの日次収集

`deploy/vps/` のコードとsystemd unit(`vrc-mens-daily.service` / `.timer`、バックアップのservice / timer)で動きます。配置は `deploy/vps/install.sh` です。パス・サービスユーザー・配置元は環境変数 `VRC_APP_DIR`、`VRC_DATA`、`VRC_SERVICE_USER`、`VRC_DEPLOY_SRC` で変更できます(省略時は従来の値)。Windowsからの操作(`scripts/vps-collector.ps1`、`sync-vps.ps1`、`rollback-vps.ps1`)は `VPS_*` 環境変数が必要で、実値はリポジトリに置きません。詳細は [VPS運用](docs/vps-collector-operations.md)。

## Cloudflareへの配置(未実施)

利用者がCloudflareアカウントで実行する手順です。`wrangler.jsonc` の `database_id` はプレースホルダーです。

```powershell
npx wrangler login
npx wrangler d1 create catalog
# 出力されたdatabase_idをwrangler.jsoncへ設定
npx wrangler d1 migrations apply catalog --remote
npx wrangler secret put ADMIN_TOKEN   # 32文字以上のランダム値。Gitやログに書かない
npx wrangler deploy
```

CLI側には同じ値を `CATALOG_ADMIN_TOKEN`、配置先URLを `CATALOG_API_URL` として環境変数で渡します(`.env.example` に書式)。管理APIはBearer認証とZod入力検証、1MBの本文上限、商品50件/バッチ。公開APIはGET/HEADのみです。

## 検証

```powershell
npm run typecheck
npm test
npm run build      # wrangler deploy --dry-run(デプロイしません)
node tests/ui.mjs  # npm run dev 起動後。ブラウザ画面検証
cd deploy/vps; python -m unittest test_worker   # VPS収集コードのテスト
```

2026-11-08時点の確認: 型チェック成功、`npm test` は30件中29件成功・1件スキップ(スキップは `data/` が存在する場合のみ実行されるテスト)、VPS側Pythonテスト8件成功。

## セキュリティ記録

依存関係の更新記録: [SECURITY-UPDATE-20261027.md](SECURITY-UPDATE-20261027.md)、[SECURITY-UPDATE-20261106.md](SECURITY-UPDATE-20261106.md)、[SECURITY-DEPENDENCIES-20261106.md](SECURITY-DEPENDENCIES-20261106.md)。

## ライセンス

現在、このリポジトリにはLICENSEファイルがありません。ライセンスが付与されていないため、法律上のデフォルトとして全権利を留保します(再利用・再配布の許諾はありません)。

## BOOTHの利用について

公式資料(BOOTHガイドライン、スクレイピング方針、robots.txt)を確認のうえ、取得は低頻度・逐次で行います。商品画像はBOOTHの画像URLをそのまま `img` の `src` に使い、ダウンロード・再ホスト・プロキシは行いません。説明全文は公開APIに含めません。
