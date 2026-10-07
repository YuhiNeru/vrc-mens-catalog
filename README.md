# VRC Men's Catalog

VRChat向けの男性アバターを選び、そのアバターの対応衣装を探す日本語カタログ。TypeScript / Cloudflare Workers Static Assets / D1。初回取得・日次差分取得はWindows上のCLIを標準とします。

2026-10-07の競合照会と不足対象の追加取得：[取得元・日時・比較表・全掲載アバター別件数](docs/competitor-audit-2026-10-07.md)。不足対象の限定取得は `npm run cli -- collect-gaps config/crawl-competitor-gaps.json`。最大60商品・3秒間隔、進捗は `data/progress-competitor-gaps.json`。男女兼用は専用一覧で表示する。

衣装の保存済み作者概要から男性向け対応先を抽出：`npm run cli -- extract-description-avatars`。[全件一覧](docs/description-male-avatars-2026-10-07.md)、全出典・作者の記載・元取得日時は `data/description-male-avatars.json`、未登録候補は `config/description-avatar-candidates.json`。ネットワークアクセスを伴わない。候補発見と確認済みの対応は区別し、女性区分・テイスト表現・関連商品の紹介だけで男性アバターと断定しない。

2026-10-07に全77候補のBOOTH本体と男女分類を照合し、確認できた47体を追加。男性アバターフロアは51体から98体になりました。[登録全件と保留理由](docs/avatar-floor-publication-2026-10-07.md) に取得元・取得日時を記録しています。`publish-description-avatars` は本体照合の再開用コマンドです。男女セット商品やカテゴリの例外は個別レビューを行い、`config/reviewed-description-avatars.json` に補正を保存しています。

## 今回確認できた実データ

2026-10-07（日本時間）、ログインなしのHTMLを取得し、実ページのJSON-LD、商品ID、ショップ、価格バリエーション、説明を確認しました。

| 種別 | 商品・出典 | 確認内容 |
|---|---|---|
| アバター | [狛乃 / 5260363](https://hyuuganatu.booth.pm/items/5260363) | 正式商品名、作者、価格。男性向け分類は下記NOXELLE作者の男性用対応一覧も根拠にレビュー |
| アバター | [くうた / 4897493](https://hotogiya.booth.pm/items/4897493) | 作者の説明で少年と明記。共通素体は未確認 |
| 衣装 | [L♥ve Cat / 5213501](https://ki-necave.booth.pm/items/5213501) | 狛乃・くうたの個別バリエーション、対象モデル一覧、素体Shrink設定の注意 |
| 衣装 | [NOXELLE / 8434318](https://studioyono.booth.pm/items/8434318) | 狛乃の男性用対応一覧と個別版、フルパック、最新版MA等の導入条件 |
| 解析確認のみ | [スーツ / 4494705](https://booth.pm/ja/items/4494705)、[Cyber MODE / 7475223](https://booth.pm/ja/items/7475223) | 通常BOOTHページ形式、価格帯。対応アバターの公開確認が足りないため一覧に掲載しない |

水瀬本体（4013951）は今回のローカル取得でショップURL・通常URLとも404でした。削除と断定せず、新規確認を保留します。競合の公開売り場の集計は比較調査として保存し、商品情報の正本にはBOOTHを使用します。

確認した公式資料：[BOOTHガイドライン](https://booth.pm/guidelines)、[スクレイピング方針](https://booth.pm/announcements/863)、[robots.txt](https://booth.pm/robots.txt)。robotsは `User-agent: *` に `/terms`、`/carts`、`/cart` のDisallowがありました。毎回クロール開始時に再取得して、対象パスを確認します。説明全文は公開APIに含めません。ユーザーの指定に従い、画像はBOOTH商品ページの画像URL（HTTPSのpximg.net）をそのままimgのsrcに使用します。画像のダウンロード・再ホスト・プロキシは行いません。旧データとの互換性のためimageAllowedフィールドは残していますが、表示条件には使用しません。

Cloudflare公式資料：[Static Assets](https://developers.cloudflare.com/workers/static-assets/binding/)、[D1 import/export](https://developers.cloudflare.com/d1/best-practices/import-export-data/)、[Workers制限](https://developers.cloudflare.com/workers/platform/limits/)、[Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/)。現時点ではCronとQueuesは導入していません。アカウント、費用、WorkersからのBOOTH本文取得は未検証です。ローカルdevで取得できてもCloudflare上で取得できたとは扱いません。

その後、ユーザーの許可で同日07:18〜07:24に拡大収集を実施。新規335商品を取得し、保存商品は合計341件。348リクエスト、HTTP 200が347件、404が1件（URL修正後に回復）、403/429は0件。既存分と今回のレビュー分を合わせ、ローカルサイトにアバター8体・衣装32商品を掲載しています。全341件を確認済みとは扱いません。[収集記録](docs/crawl-2026-10-07.md) に範囲・条件を記録しました。今回の追加レビューは `config/reviewed-expanded.json`。適用には収集済み対象商品が必要です。

追加の計画収集は同日08:34に商品取得を完了。8体・10検索・全91ページから重複除去後2,336商品を発見し、保存済み分を除いて取得。保存総数2,498商品、掲載対象の衣装1,396商品になりました。計画全体で2,252リクエスト（すべてHTTP 200）、商品取得失敗0件。途中のWindows保存エラーは再試行処理の追加後に復旧しました。[計画収集記録](docs/crawl-comprehensive-2026-10-07.md) に結果を追記しています。[VRCFinderの参考調査](docs/reference-vrcfinder.md) から見つけた追加モデル候補は本体確認待ちです。

## ローカル起動

2026-10-07の追加作業でアバター46体へ拡大し、男女兼用を専用ページへ分離しました。通常の衣装一覧とアバター詳細の通常枠には男女兼用を混ぜません。分類の根拠・件数・追加収集範囲は [追加記録](docs/avatar-expansion-and-unisex-2026-10-07.md) を参照してください。

Node.js 22.13以上（今回24.14.1）、npm、Windows PowerShell。初回のみ依存関係をインストールします。

```powershell
cd C:\Code\vrc-mens-catalog
npm ci
npm run db:migrate
# 今回の作業環境にはdata/catalog.jsonと保存HTMLが作成済み
npm run db:seed
npm run dev
```

http://localhost:8787 を開きます。D1のローカルDBは `.wrangler/state` に保存。`db:seed` は `data/catalog.json` からSQLを書き出し、ローカルD1へUPSERTします。データ・状態・秘密情報はGit除外対象です。別PC・新規チェックアウトでデータがない場合、以下の初回収集を実行してください。

## 初回収集とレビュー

```powershell
npm run cli -- initial
npm run cli -- review
# config/reviewed.json は今回、保存した実ページで確認した補正
# 対象商品が正常に取得できていることをreviewで確認してから適用
npm run cli -- override config/reviewed.json
npm run db:seed
```

`config/avatars.json` に本体の商品ID、正式名、別名、作者、分類根拠を登録。共通素体は根拠がある場合だけ `bodyId` と `bodyEvidence` を設定します。共通素体などの追加登録は `npm run cli -- import ファイル名.json`（`src/shared/model.ts` のImportData形式、products/avatars/bodies/compatibility/runs）で行えます。日次の限定取得は `config/crawl.json`。アバターごとの衣装カテゴリ検索を全ページ巡回する計画収集は下記のplan/collect-planを使用します。

商品タイトルだけ、紹介した他の商品、撮影アバターなどの言及は `candidate` に残します。衣装カテゴリの商品で作者の購入バリエーションに対象アバターが明示され、非対応・未確認・セミ対応・変換前提などの注意がない場合は `verified` として掲載します。根拠欄に自動照合であることと対象版を明記します。曖昧な関係は管理者レビューへ残します。`full`、`semi`、`conversion`、`unknown` は別区分。未知の区分は確認済み設定を拒否します。

公開には商品とアバターの両方の確認が必要です。衣装は、公開済みアバターまたは根拠のある共通素体への確認済み関係が必要。共通素体の互換性を未確認アバターへ展開しません。中性的・壮年なども `ageGroup` に登録可能で、利用者本人の性別情報を集めません。

補正例（配列としてJSON保存して `override ファイル名`）：

```json
[
  {"entity":"product","key":"5213501","patch":{"category":"セットアップ","style":"カジュアル","review":"verified"}},
  {"entity":"compatibility","key":"5213501:avatar:kuuta","patch":{"review":"excluded","evidence":"管理者による除外理由"}}
]
```

関係の追加・修正・除外は `productId:avatar:avatarId` または `productId:body:bodyId` をキーにします。追加には既知の商品と対象、fit、review、evidence、variantNamesが必要です。補正は元データを上書きせず独立テーブルに保存。次のクロール後も残ります。レビューの候補はCLI、または認証付き `GET /api/admin/review` で確認できます。補正の解除は明示的な逆補正を登録してください。

## 計画収集（2026-10-07追加）

公開確認済みアバターの名前と日本語別名ごとに「3D衣装」カテゴリを検索。最初に件数を調べ、アバター間で順番にページを送り、全ページの検索カードを集めます。商品IDを全検索で重複除去し、保存済み商品を除いた取得キューを確定してから商品本文を取得します。現在の範囲は8体・10検索・91ページ、表示件数と実際のカード件数は全検索で一致、重複除去後2,336商品です。これは検索範囲の網羅であり、全BOOTHや全男性アバターの網羅ではありません。

```powershell
npm run cli -- plan
npm run cli -- collect-plan
# 前の計画が完了後、掲載中の全アバターを名前・英語別名から再検索
npm run cli -- plan-refresh
npm run cli -- collect-plan
# 別のPowerShellで取得中のローカルサイトへの自動反映
.\scripts\publish-local-progress.ps1
# 同じコマンドで保存した続きから再開
Get-Content data/progress-comprehensive.json -Encoding utf8
# 保存済みHTMLの対象版を再照合（ネットワーク取得なし）
npm run cli -- relist-saved
# 完了後にローカルサイトへ反映
npm run db:seed
```

全アバターの再検索では英語別名も使用し、導入条件・共通素体名などは検索語から除きます。`data/progress-comprehensive.json` に進捗と商品取得段階の予想完了時刻を保存。再収集後は `npm run cli -- coverage-report` で、フロアへの反映を確認して全アバターの対応件数・検索元・取得日時を [再収集結果](docs/avatar-name-recrawl-2026-10-07.md) に出力します。今回のバックグラウンド実行は収集・3分ごとの反映・完了レポート・UI検証まで設定済みです。

設定は `config/crawl-comprehensive.json`。逐次取得、最短間隔1秒、1日の共通予算12,000リクエスト、検索ごと100ページ、最大10,000新規商品。通常dailyの設定とは別です。検索件数・取得ページ・発見件数・対象商品ID・進捗は `data/coverage-plan.json` に保存します。失敗は `data/failures.jsonl` と `data/retry.json`、成功分はHTML・outbox・カタログへ即保存。停止・上限はprogressに理由を表示し、403/429の扱いは通常取得と共通です。掲載判定と画像表示は日次取得にも適用します。

大きくなったカタログの継続更新には `npm run cli -- daily config/crawl-daily-expanded.json` を使用できます。同じ10検索の新着ページを確認し、既知商品の7日以上経過したものを古い順に更新します。1日500リクエスト・3秒間隔で、新着を優先して1回のキューを予算内へ収めます。大きな既知商品キューで翌日の検索を塞がないための設定です。通常の30件設定と未登録のタスクスケジューラは変更していません。今回の途中経過と範囲は [計画収集記録](docs/crawl-comprehensive-2026-10-07.md) に記録しています。

## 日次取得と復旧

98体への確認済み対応がない男女兼用衣装には、BOOTHの作者タグとは別に `catalogTags: ["no-confirmed-floor-98"]` を付けます。表示名は「98体対応未確認」。対象は `config/floor-avatar-scope.json` の98体で、採用根拠がある共通素体への確認済み対応も数えます。候補・未確認の対応は数えません。後から98体への対応が確認できた商品は自動でタグが外れます。APIは `/api/products?audience=unisex&tag=no-confirmed-floor-98`（24件ごとの `page` 指定）、UIは `/#unisex?tag=no-confirmed-floor-98`、全件JSONは `npm run cli -- export-floor-tagged` で `data/no-confirmed-floor-98.json` に抽出できます。「対応未確認」は非対応の断定ではありません。

2026-10-07のユーザー指定で、女性アバターや掲載中98体以外のモデルへの対応が確認できる衣装を男女兼用フロアへ掲載するルールに拡張しました。98体への対応がなくても別枠には掲載します。98体の範囲は `config/floor-avatar-scope.json` に記録し、未登録モデルの性別は推測しません。撮影・紹介・対応予定・非対応・共通素体だけの記載は分類根拠にしません。保存済み分は `npm run cli -- reclassify-audience` で再分類できます。通常枠との分離と原画像URLは維持します。

今回の初回再収集に限り、ユーザーの指示で日次上限を免除しました。`config/crawl-comprehensive.json` の `dailyLimitExemptPlanId` が実行中の計画IDと一致する場合だけ適用し、完了時に設定を自動削除します。通常の日次更新・次の計画は従来の上限を維持します。アクセス間隔、robots、403・429・認証制限での停止、再試行上限は維持します。リクエスト数の記録も継続します。

今回ユーザーの指示で、初回拡大収集用の `config/crawl-expanded.json` を追加しました。男性向け候補8体を起点に、検索10ページ、最大400商品、間隔1000ms、リクエスト500件まで。通常の日次設定（30件/日・3000ms）は維持します。拡大収集を行った日は共通予算を使うため、通常dailyの30件を超えていれば翌日まで通常dailyは停止します。403/429等の停止条件は拡大収集でも共通です。

```powershell
npm run cli -- initial config/crawl-expanded.json
# 同じコマンドで途中再開。進捗と完了時刻予測を確認
Get-Content data/progress-crawl-expanded.json
# 拡大設定の予算内で失敗商品を再試行
npm run cli -- retry config/crawl-expanded.json
```

取得・解析と公開レビューは別段階です。拡大収集の候補は、対応の根拠を確認して補正を登録するまで公開しません。今回の実行ログは `data/logs/expanded-crawl.log`、HTTPステータスと応答時間は `data/requests.jsonl`、途中再開情報は `data/checkpoint-initial-crawl-expanded.json` に保存します。

```powershell
npm run cli -- daily
npm run cli -- sync
# 保存済みHTMLだけを解析し直す（外部アクセスしない）
npm run cli -- parse-saved
# 失敗した商品を再試行
npm run cli -- retry
```

既知商品は最終取得から7日以上経過した順で更新。毎日全部は取り直しません。新着検索と既知商品の更新は同じcheckpointのキューで処理し、停止時は次回同じコマンドで続きから再開。正常終了後、次回は新しい実行を開始します。公開日時が取得できない商品はnull、一覧の「新着・取得順」は取得日時へフォールバックします。

安全側の設定：逐次取得（concurrency=1）、間隔3000ms、1日30リクエスト、再試行最大2回、タイムアウト20秒。環境変数例は `.env.example`。このMVPでは並列数1のみを受理します。間隔は1000ms未満を拒否し、1日上限は500以下に制限。robots、検索、再試行も上限に含め、`data/budget-YYYY-MM-DD.json` を使って日本時間の同日中の全ローカル実行を合算します。複数PCで同時運用しないでください。

- 403/401、CAPTCHA・確認画面、リダイレクトは停止。回避手段はありません。
- 429はRetry-Afterを尊重。再発または60秒を超える待機は停止して次回へ。指定された再開可能時刻はcheckpointに記録し、その前の手動再開も取得せず停止します。
- 一時的な5xx・タイムアウトは回数制限つきで再試行。
- 404・取得失敗・解析失敗では保存済み商品を消しません。非公開にしたい場合は管理補正のavailabilityかreviewを変更します。
- 成功した1商品ごとにHTML、outbox、カタログ、checkpointを保存。outboxを先に保存し、途中停止後はローカルへ再反映。送信失敗はoutboxを残して再送。再送は取得日時を比較し、古いデータで新しいデータを巻き戻しません。

`data/catalog.json`、`data/checkpoint-*.json`、`data/outbox`、`.wrangler` は必要に応じてバックアップしてください。上限停止は終了コード2、設定・送信・ロック等のエラーは1、正常は0。履歴はcatalogのruns、商品失敗は `data/failures.jsonl`、ラッパーのログは `data/logs`。

プロセス強制終了で `data/crawler.lock` が残った場合、ファイルのpidと稼働中プロセスを確認し、当該クローラーが停止していることを確かめてからそのファイルだけ削除します。通常は自動解除。同時にinitial/daily/sync/補正を起動しても、ロックがある方は処理しません。

## Cloudflareへの配置（未実施）

以下は利用者がCloudflareアカウントで実行する手順です。ローカルのdb:migrateとは別です。

```powershell
npx wrangler login
npx wrangler d1 create catalog
# 出力されたdatabase_idをwrangler.jsoncへ設定
npx wrangler d1 migrations apply catalog --remote
npx wrangler secret put ADMIN_TOKEN
# 32文字以上のランダムなトークンを入力。Gitやログに書かない
npx wrangler deploy
```

CLI側に `CATALOG_API_URL` と同じ値の `CATALOG_ADMIN_TOKEN` を設定します。認証情報は環境変数または適切なシークレット管理から渡します。Node.jsのenvファイルを使うならGit除外の `.env` を作成し `node --env-file=.env --import tsx src/cli/main.ts sync`。PowerShellラッパーは環境変数を継承するため、タスクで使う場合はタスクユーザーの環境で設定が必要です。トークンをタスク引数に記載しません。

```powershell
npm run cli -- sync
# 初回SQLインポートを選ぶ場合（外部DBを変更するので設定先を確認）
npm run cli -- export
npx wrangler d1 execute catalog --remote --file data/import.sql
# 配置したWorkerの実行環境で商品と検索本文を各1件確認
npm run cli -- probe-cloudflare
```

`probe-cloudflare` は認証付き固定取得先のAPIを呼び、robotsと本体・検索の本文解析を確認します。HTTP 200だけを成功としません。このAPIに外部URLやトークンを返す機能はありません。**実際のCloudflare上でのprobeはまだ実施していません。** 成功しても自動でローカルからCronへ切り替えません。Cron移行は運用費・実行上限・取得制限を確認し、ローカルタスクを停止してから実施する追加作業です。

管理APIはBearer認証とZodの入力検証、1MBの本文上限、商品50件/バッチ。public APIはGET/HEADのみ。管理トークンをUIに渡しません。TLS必須（ローカルlocalhostだけHTTP可）。DB障害は503として返し、詳細や認証情報をレスポンスへ出しません。

## Windowsタスクスケジューラ（登録は未実施）

仮時刻は毎日04:00日本時間。登録スクリプトの時刻は**Windowsのローカル時刻**なので、PCタイムゾーンを日本標準時に設定してください。登録・変更・解除はユーザーが明示的に実行します。

```powershell
# 初回手動確認。Cloudflareの認証情報がある場合は正常終了後にsync
.\scripts\run-crawler.ps1 -Mode daily
# ローカル取得だけ確認する場合
.\scripts\run-crawler.ps1 -Mode daily -NoSync
# 登録 / 時刻の変更（同名で置換）
.\scripts\register-task.ps1 -Time '04:00'
.\scripts\register-task.ps1 -Time '06:30'
# 手動起動 / 状態 / 解除
Start-ScheduledTask -TaskName VRCMensCatalogDaily
Get-ScheduledTaskInfo -TaskName VRCMensCatalogDaily
.\scripts\register-task.ps1 -Action Remove
```

現在ユーザーがログイン中のとき実行し、重複起動はIgnoreNew。StartWhenAvailableで取り逃し後の実行を許可します。PC電源OFF・スリープ中は実行できません。次のログイン・稼働時に確認し、必要なら上記手動実行。途中停止はcheckpointから再開。収集が停止しても保存済み結果だけを再送したい場合は `-Mode sync`。タスク最長2時間で強制終了された場合もロック回復の手順を使ってください。

## 構造と検証

`src/shared` にHTML解析、正規化、取得制限、モデル、SQL生成。`src/cli` にファイル保存・再開・反映アダプター。`src/worker` にD1とHTTPアダプター。`public` は依存の少ないレスポンシブ日本語UI。DBは商品、本体、共通素体、商品対対象の多対多関係、独立補正、実行履歴を保持。価格は各バリエーションと全体の最低/最高価格を保存し、未取得はnull。絞り込みは全体の最低価格に適用するため、個別対応版の価格は展開表示で確認してください。

```powershell
npm run typecheck
npm test
npm run build
# npm run devでサーバー起動後。既存Edgeを使う画面検証
node tests/ui.mjs
```

保存した実HTMLから短いメタデータfixtureを作り、外部アクセスなしで繰り返し検証します。テストは価格帯/無料版、複数対応、誤認防止、semi/conversion、403/429/5xx、チャレンジ、SQLite再取り込み、古い再送、補正永続性、公開APIの書込禁止、認証、CLI途中再開、日次予算、失敗データの保持、反映失敗後の再送を対象にします。画面テストは一覧/詳細/対応版、絞り込み、空状態、390px幅の横はみ出し、ブラウザエラーを確認します。

未検証：Cloudflare実配置とD1 remote、WorkersからBOOTHへの取得、Windowsタスクの実際の定時実行、長期運用、大量データ・全カテゴリ。現状APIは小規模MVPとして全商品メタデータを読みフィルターします。件数拡大時はSQL検索/インデックス/ページングをDB側へ移し、運用件数・料金上限を確認してください。サイト全体の網羅性を保証しません。
