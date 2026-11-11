# ConoHa VPSでの収集運用

移行日:2026-10-12 JST。初回の全件クロールは2026-10-14に完走済み(`phase=complete`)です。以後の更新は `vrc-mens-daily.timer`(`daily.py`)が担い、常駐の `vrc-mens-collector.service` は役目が終わったため2026-11-08にVPS上で `disable` しました(ユニットファイルは残してあります)。SSHは常に `StrictHostKeyChecking=yes` と確認済みknown-hostsを使用します。秘密鍵はWindows上でのみ使用し、内容の表示・転送は行いません。

## 接続設定(必須の環境変数)

このリポジトリには実際のホスト・ユーザー・鍵・パスの値を置きません。VPS操作スクリプト(`scripts/vps-collector.ps1`、`scripts/sync-vps.ps1`、`scripts/rollback-vps.ps1`)は、次の環境変数がすべて設定されていないと動作しません。実値が必要です。値は各自の環境にだけ設定し、リポジトリへコミットしないでください(`.env.example` に書式のプレースホルダーがあります)。

| 環境変数 | 内容 |
|---|---|
| `VPS_SSH_TARGET` | SSH接続先 `<VPS_USER>@<VPS_HOST>` |
| `VPS_SSH_KEY` | SSH秘密鍵ファイルのパス |
| `VPS_KNOWN_HOSTS` | 確認済みknown-hostsファイルのパス |
| `VPS_SERVICE_USER` | 収集サービスを動かす専用の非管理者ユーザー |
| `VPS_APP_DIR` | VPS上のプログラム配置先 |
| `VPS_STATE_DIR` | VPS上のデータ配置先(`exports` などがこの下に作られる) |

## 配置と処理の分担

| 項目 | 構成 |
|---|---|
| 初回クロール(完了済み・2026-11-08に disable) | `vrc-mens-collector.service`(`worker.py`) |
| 日次更新 | `vrc-mens-daily.timer` / `vrc-mens-daily.service`(`daily.py`) |
| DB・生の商品ページ・進捗・バックアップ・差分エクスポート | `VPS_STATE_DIR` 配下 |
| プログラム | `VPS_APP_DIR` |
| 日次バックアップ | `vrc-mens-collector-backup.timer`(`manage.py backup`、毎日03:30 JST) |
| バックアップの整理 | VPS側の `mens-backup-prune.timer`(毎日04:30 JST)。最新7世代(7日分)を残して削除。このリポジトリには含まれません |

VPSはHTTP取得、既存TypeScriptロジックによる解析・対応確認・小物分類、重複除去、SQLiteへの保存、終了時のスキ数取得を担当します。Python標準ライブラリと、専用ディレクトリ内のNode.js、依存ライブラリをまとめた解析用JSだけで動きます。ブラウザ・npm常駐・Wrangler・LLM・翻訳・ベクトル生成・外部AI APIはVPSに導入していません。現行収集経路には有料AI APIの呼び出しがなく、AI API費用は発生しません。

フロントエンドとローカルD1、ユーザーの手動補正はWindowsに残ります。商品画像は従来どおりBOOTHの画像URLを使用します。

## 日次更新(daily.py)

`vrc-mens-daily.timer` が毎時:10(JST)に `vrc-mens-daily.service`(`Type=oneshot`)を起動し、`daily.py` を実行します。`daily.py` は `worker.py` の `Fetcher`、`Parser`、`connect`、`get/put` を import して使うため、`worker.py` は常駐させなくても削除してはいけません(`manage.py` も import します)。

- 実質1日1回(JST 0:10台)実行し、当日分が `phase=complete` なら即終了します。失敗時は1時間ごとに有界リトライします。
- 新着検索から新規候補を発見し、7日以上更新されていない確認済み小物・分類・watchlist掲載分を最大400件再取得し、小物のスキ数を更新します。
- 1日のリクエスト上限は500(`daily_budgets` テーブル)。初回クロールの1日12,000件(`budgets`)とは別に数えます。
- 前提は、DBの `meta.phase` が `complete` であることです(ワーカーのプロセスが動いている必要はありません)。`manage.py resume` はこの `phase` を `products` に戻し、日次更新が `initial_collection_not_complete` で止まるため、完了後は実行しないでください。
- 操作: `manage.py daily-resume`(Retry-After経過後の再開)、`daily-likes`(スキ数の再取得)、`daily-continue`(商品の継続)、`status --compact`(日次状態の要約)。

## 制限と再開

以下は初回クロール(`worker.py`)の仕様です。完了済みのため通常は動きません。

- 通信は同時1件、開始間隔3秒、タイムアウト20秒。移行前のJST日次12,000リクエスト使用量を引き継ぎます。
- キュー位置、商品、対応根拠、変更通知を同じSQLiteトランザクションで保存します。再起動後は未完了の最初の位置から進みます。
- 401/403、リダイレクト、challenge、robots禁止は停止。429はRetry-After以降まで待機し、繰り返す制限は停止します。ネットワーク・5xxは短い再試行後に待機し、継続5回で停止します。停止コード20はsystemdから再試行しません。
- 日次待機中も、24時間以内に確認済みのrobotsと保存済みHTMLで、通信なしの解析を進められます。`cursor`は最初の未完了位置、`processed`は完了・取得不能の合計です。このため、待機中はcursorが固定でもprocessedが増える場合があります。
- 解析子プロセスは50リクエストごとに再生成。Unicode・大きな説明文はBase64フレームと応答IDで受け渡し、内容をログへ出しません。
- systemdによるCPU・メモリ・タスク数の制限と、読み書きを専用データディレクトリに制限する設定は `deploy/vps/` のunitファイルを参照してください。

## Windowsからの通常操作

プロジェクトのルートで実行します。認証情報を入力・保存する必要はありません。上記の環境変数で指定したSSH鍵とknown-hostsファイルを参照します。

```powershell
# 進捗・メモリ・CPU累積値(常駐サービスと日次タイマー/サービスの状態、`manage.py status --compact` の要約を含む)
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/vps-collector.ps1 status
# 最近のログ(商品本文・Cookie・トークンを出力しない)
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/vps-collector.ps1 logs
# 以下の stop / start は初回クロール用の常駐サービス向け(2026-11-08以降は disable 済み)。
# start は manage.py resume を呼び phase を戻すため、日次更新が止まる恐れがある。通常は使わない。
# 停止(自動起動の設定は残る)
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/vps-collector.ps1 stop
# 明示的に再開。Retry-Afterと日次待機期限は短縮しない
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/vps-collector.ps1 start
# DBをその場で整合したスナップショットへ保存
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/vps-collector.ps1 backup
# 日次更新(vrc-mens-daily.timer / .service)の停止。タイマーの自動起動設定は残る
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/vps-collector.ps1 daily-stop
# 日次更新の再開(manage.py daily-resume のあとタイマーとサービスを起動)。Retry-After経過前は manage.py が拒否し、起動しない
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/vps-collector.ps1 daily-resume
# VPSの差分をローカルJSON・D1へ取り込み
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/sync-vps.ps1
```

同期は**手動**です。同時実行は `data/vps-sync/script.lock` で防ぎます(実行中に再度起動するとエラーで止まります)。`scripts/export-watchlist.ts` がある場合は、取り込みのあとにそのwatchlistをVPSへ送り、日次更新が読む `watchlist.json` を置き換えます(ファイルが無ければこの手順は省略され、同期は失敗しません。この手順の失敗は警告のみです)。アプリの再起動は不要で、同期完了後に一覧を再読み込みします。VPSの日次更新(`vrc-mens-daily.timer`)はWindowsを切っても継続しますが、ローカルの一覧は次の同期まで更新されません。

同期の確定位置は `data/vps-sync/cursor.json`。SQLiteの一貫した読み取りで確定した連番までを取得し、ローカル側では商品IDと取得日時で追加・更新します。ローカルのavatars・bodies・runs等を置き換えず、手動補正の既存値を優先します。D1にだけ存在する既存overrideも上書きしません。取り込みが途中で失敗した場合は連番を進めず、同じ差分を再実行できます。既存DB全体の上書きはしません。

ローカル収集は `data/vps-migration-active.json` により起動を拒否します。VPSが稼働中のままこのファイルを削除しないでください。

## バックアップ・復元

日次タイマーと手動バックアップはSQLite Backup APIを使います。稼働中のWALを単純コピーする方式ではありません。DBの `.sqlite` と同名の `.seed.json` が一組です。raw HTMLはバックアップ対象DBに含まれません。未処理・未取得ページは必要に応じ再取得できます。バックアップはVPS側の `mens-backup-prune.timer` が最新7世代を残して整理しますが、`/var/lib/vrc-mens-collector/backups` のディスク容量は定期確認します。

VPSで復元する場合(`<SERVICE_USER>`、`<APP_DIR>`、`<STATE_DIR>` は上記環境変数の値):

```bash
systemctl stop vrc-mens-collector.service
runuser -u <SERVICE_USER> -- python3 <APP_DIR>/manage.py backup
runuser -u <SERVICE_USER> -- python3 <APP_DIR>/manage.py restore --backup <STATE_DIR>/backups/collector-YYYYMMDDTHHMMSSffffffZ.sqlite
systemctl start vrc-mens-collector.service
```

復元コマンドは当サービスの稼働中には拒否し、指定したバックアップの整合性を確認します。復元前の新しいバックアップも残します。

移行前のローカルバックアップ:`data/backups/pre-vps-20261012-104604`。catalog.json、巡回位置、分類、日次使用量、オンラインバックアップしたローカルD1を保持しています。既存のraw HTMLもWindows上に残しています。

## Windowsへ戻す場合

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/rollback-vps.ps1
```

まずWindowsのスケジュールタスク `VRCMensCatalogSync`(あれば)を無効化・停止し、VPSの常駐サービス(`vrc-mens-collector.service`)と日次タイマー・サービス(`vrc-mens-daily.timer`、`vrc-mens-daily.service`)を停止・自動起動解除します。三つとも停止していることを確認できてから差分、巡回位置、日次使用量、VPSで新たに保存したHTMLを回収します。その後でローカルの移行マーカーを解除し、非表示のプロセスとしてローカル収集を再開します。VPSの停止またはデータ回収が確認できなければローカルは起動しません。

日次待機中に先行処理したキャッシュは、旧ローカル方式へ戻した場合、最初の未完了位置以降で再照合されることがあります。DB保存は商品IDで重複排除され、取得済みHTMLがあれば再通信しません。

今回の新規HTTP取得の本番確認は、10月12日の既存日次上限を使い切っているため、10月13日00:01 JST以降になります。それまでは保存済みページの処理・DB保存・分類・差分同期・再起動再開を検証しています。`downloaded`、`lastDownloadAt`、`lastRequestStatus` で新規取得を確認できます。

## 移行後の実測・検証結果

2026-10-12 11:12 JST確認。データ元:移行時seed、VPS manage.py status/systemctl show、ローカル `/api/products?kind=accessory`。

| 指標 | 移行前 | 移行後 |
|---|---:|---:|
| 処理済み候補 | 51,288 | 54,598 |
| 最初の未完了位置cursor(0始まり) | 51,288 | 51,288 |
| 新規ページ取得累計 | 43,514 | 43,514(日次待機) |
| キャッシュ処理累計 | 7,761 | 11,071 |
| 取得不能 | 13 | 13 |
| 掲載小物 | 1,398 | 1,403 |
| 残り未完了 | 28,716 | 25,406 |
| DBの商品行数 | 58,094 | 58,094(既存キャッシュの照合・更新) |

最初の未取得ページを残したまま先行キャッシュ処理を進めているため、cursorは固定です。商品ID単位で既存行を更新し、キューの完了件数と対応確認済み小物が増えることを検証しました。ローカルは変更連番3,066まで同期済み。この時点のVPS連番は3,310で、以降の差分も次回同期できます。

- 型チェック、既存テスト30件、移行版のSQLite・停止・日次制限・バックアップ復元テスト8件が成功。移行版8件はUbuntu 24.04上でも成功。
- 大きなUnicodeデータ100フレームのIPC試験、実BOOTH HTMLをNodeヒープ160MB上限で解析する試験が成功。
- 初期IPCの分断による停止を修正し、誤って失敗扱いにした3件を再処理。修正後に約2,900件を連続処理しました。サービス再起動のSIGTERMを子プロセスへ同時送信しないKillMode=mixedを設定し、保存位置を保って継続することを実サービスで確認。
- 差分取り込み後、既存のローカルD1 override全件とアバター行が保持されていることを比較確認。小物一覧1,403件をローカルAPIで確認。
- 移行前のJSON・D1をバックアップして整合性確認。VPSの実DBでもSQLiteオンラインバックアップを複数回作成。復元は隔離DBで検証済み。本番の全面ロールバックは実行していません。

ローカルの `data/progress-full-accessories.json` は切り替え時点で止まります。移行後の進捗は `scripts/vps-collector.ps1 status` またはVPSのprogress.jsonを確認してください。
