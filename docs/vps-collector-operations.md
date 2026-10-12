# ConoHa VPSでの収集運用

移行日：2026-10-12 JST。対象ホスト：160.251.167.191（Ubuntu 24.04、1GB RAM、2 CPU）。SSHは常に `StrictHostKeyChecking=yes` と確認済みknown-hostsを使用します。秘密鍵はWindows上でのみ使用し、内容の表示・転送は行いません。

## 配置と処理の分担

| 項目 | 場所・構成 |
|---|---|
| 専用ユーザー | `vrcmens`（非管理者・ログイン不可） |
| 常駐サービス | `vrc-mens-collector.service` |
| プログラム | `/opt/vrc-mens-collector` |
| DB | `/var/lib/vrc-mens-collector/collector.sqlite` |
| 生の商品ページ | `/var/lib/vrc-mens-collector/raw` |
| 軽量進捗 | `/var/lib/vrc-mens-collector/progress.json` |
| バックアップ | `/var/lib/vrc-mens-collector/backups` |
| 差分エクスポート | `/var/lib/vrc-mens-collector/exports` |
| 日次バックアップ | `vrc-mens-collector-backup.timer`（03:30 JST＋最大10分の分散） |

VPSはHTTP取得、既存TypeScriptロジックによる解析・対応確認・小物分類、重複除去、SQLiteへの保存、終了時のスキ数取得を担当します。Python標準ライブラリと、専用ディレクトリ内のNode.js 24.14.1、依存ライブラリをまとめた解析用JSだけで動きます。Node配布物は公式SHASUMS256と照合済みです。ブラウザ・npm常駐・Wrangler・LLM・翻訳・ベクトル生成・外部AI APIはVPSに導入していません。現行収集経路には有料AI APIの呼び出しがなく、AI API費用は発生しません。

フロントエンドとローカルD1、ユーザーの手動補正はWindowsに残ります。商品画像は従来どおりBOOTHの画像URLを使用します。

## 制限と再開

- 通信は同時1件、開始間隔3秒、タイムアウト20秒。移行前のJST日次12,000リクエスト使用量を引き継ぎます。
- キュー位置、商品、対応根拠、変更通知を同じSQLiteトランザクションで保存します。再起動後は未完了の最初の位置から進みます。
- 401/403、リダイレクト、challenge、robots禁止は停止。429はRetry-After以降まで待機し、繰り返す制限は停止します。ネットワーク・5xxは短い再試行後に待機し、継続5回で停止します。停止コード20はsystemdから再試行しません。
- 日次待機中も、24時間以内に確認済みのrobotsと保存済みHTMLで、通信なしの解析を進められます。`cursor`は最初の未完了位置、`processed`は完了・取得不能の合計です。このため、待機中はcursorが固定でもprocessedが増える場合があります。
- 解析子プロセスは50リクエストごとに再生成。Unicode・大きな説明文はBase64フレームと応答IDで受け渡し、内容をログへ出しません。
- systemd：CPUQuota 50%（1コアの半分、2コア合計の約25%）、MemoryHigh 256MB、MemoryMax 384MB、MemorySwapMax 128MB、TasksMax 32。Nodeヒープ上限160MB。読み書きは専用データディレクトリに制限します。
- 公開待受ポートは追加していません。既存のSSHとファイアウォールの設定は変更していません。

## Windowsからの通常操作

プロジェクトのルートで実行します。認証情報を入力・保存する必要はありません。既存のSSH鍵とknown-hostsファイルを参照します。

```powershell
# 進捗・メモリ・CPU累積値
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/vps-collector.ps1 status
# 最近のログ（商品本文・Cookie・トークンを出力しない）
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/vps-collector.ps1 logs
# 停止（自動起動の設定は残る）
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/vps-collector.ps1 stop
# 明示的に再開。Retry-Afterと日次待機期限は短縮しない
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/vps-collector.ps1 start
# DBをその場で整合したスナップショットへ保存
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/vps-collector.ps1 backup
# VPSの差分をローカルJSON・D1へ取り込み
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/sync-vps.ps1
```

同期は**手動**です。アプリの再起動は不要で、同期完了後に一覧を再読み込みします。VPSの新規取得はWindowsを切っても継続しますが、ローカルの一覧は次の同期まで更新されません。

同期の確定位置は `data/vps-sync/cursor.json`。SQLiteの一貫した読み取りで確定した連番までを取得し、ローカル側では商品IDと取得日時で追加・更新します。ローカルのavatars・bodies・runs等を置き換えず、手動補正の既存値を優先します。D1にだけ存在する既存overrideも上書きしません。取り込みが途中で失敗した場合は連番を進めず、同じ差分を再実行できます。既存DB全体の上書きはしません。

ローカル収集は `data/vps-migration-active.json` により起動を拒否します。VPSが稼働中のままこのファイルを削除しないでください。

## バックアップ・復元

日次タイマーと手動バックアップはSQLite Backup APIを使います。稼働中のWALを単純コピーする方式ではありません。DBの `.sqlite` と同名の `.seed.json` が一組です。raw HTMLはバックアップ対象DBに含まれません。未処理・未取得ページは必要に応じ再取得できます。バックアップは自動削除しないため、ディスク容量を定期確認します。

VPSで復元する場合：

```bash
systemctl stop vrc-mens-collector.service
runuser -u vrcmens -- python3 /opt/vrc-mens-collector/manage.py backup
runuser -u vrcmens -- python3 /opt/vrc-mens-collector/manage.py restore --backup /var/lib/vrc-mens-collector/backups/collector-YYYYMMDDTHHMMSSffffffZ.sqlite
systemctl start vrc-mens-collector.service
```

復元コマンドは当サービスの稼働中には拒否し、指定したバックアップの整合性を確認します。別サービスのファイルを受け付けません。復元前の新しいバックアップも残します。

移行前のローカルバックアップ：`data/backups/pre-vps-20261012-104604`。catalog.json、巡回位置、分類、日次使用量、オンラインバックアップしたローカルD1を保持しています。既存のraw HTMLもWindows上に残しています。

## Windowsへ戻す場合

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/rollback-vps.ps1
```

まずVPSの当サービスだけを停止・自動起動解除し、停止確認に成功してから差分、巡回位置、日次使用量、VPSで新たに保存したHTMLを回収します。その後でローカルの移行マーカーを解除し、非表示のプロセスとしてローカル収集を再開します。VPSの停止またはデータ回収が確認できなければローカルは起動しません。World Compassには触れません。

日次待機中に先行処理したキャッシュは、旧ローカル方式へ戻した場合、最初の未完了位置以降で再照合されることがあります。DB保存は商品IDで重複排除され、取得済みHTMLがあれば再通信しません。

## 既存サービスについて

World Compassのサービス設定のSHA256は移行前後とも `ebfa9a179bf0114e66ad79317e3e34d020e085fd03e0ad72fcd952f04be55c97`。プログラムディレクトリはroot:root 755、データディレクトリはUID999:GID988 700のままです。DB・認証・設定・権限を変更する操作はしていません。

移行版の起動（10:51 JST）より前の10:44 JSTにも、既存World Compassの終了コード1と自動再起動が記録されていました。稼働中であることは確認できますが、継続的な正常収集までの保証はできません。今回の依頼では既存サービスの修正・認証変更を行っていません。

今回の新規HTTP取得の本番確認は、10月12日の既存日次上限を使い切っているため、10月13日00:01 JST以降になります。それまでは保存済みページの処理・DB保存・分類・差分同期・再起動再開を検証しています。`downloaded`、`lastDownloadAt`、`lastRequestStatus` で新規取得を確認できます。

## 移行後の実測・検証結果

2026-10-12 11:12 JST確認。データ元：移行時seed、VPS manage.py status/systemctl show、ローカル `/api/products?kind=accessory`。

| 指標 | 移行前 | 移行後 |
|---|---:|---:|
| 処理済み候補 | 51,288 | 54,598 |
| 最初の未完了位置cursor（0始まり） | 51,288 | 51,288 |
| 新規ページ取得累計 | 43,514 | 43,514（日次待機） |
| キャッシュ処理累計 | 7,761 | 11,071 |
| 取得不能 | 13 | 13 |
| 掲載小物 | 1,398 | 1,403 |
| 残り未完了 | 28,716 | 25,406 |
| DBの商品行数 | 58,094 | 58,094（既存キャッシュの照合・更新） |

最初の未取得ページを残したまま先行キャッシュ処理を進めているため、cursorは固定です。商品ID単位で既存行を更新し、キューの完了件数と対応確認済み小物が増えることを検証しました。ローカルは変更連番3,066まで同期済み。この時点のVPS連番は3,310で、以降の差分も次回同期できます。

- サービス全体（SQLite等のファイルキャッシュ込み）のメモリ：11:12時点で約224MB、最終稼働確認では約210MB・実測ピーク約257MB（上限384MB、MemoryHigh 256MB）。Python RSS約31MB、Node RSS約90MB。短時間の20秒観測では最大149MB、CPU49.9%/1コア。別の20秒観測ではCPU46.5%/1コア。2コア合計の約23〜25%に相当します。
- World Compass：同時点でactive/running、サービス全体約29MB、Python RSS約29MB。設定ハッシュ・ディレクトリ所有者・権限が移行前と一致。
- 型チェック、既存テスト30件、移行版のSQLite・停止・日次制限・バックアップ復元テスト8件が成功。移行版8件はUbuntu 24.04上でも成功。
- 大きなUnicodeデータ100フレームのIPC試験、実BOOTH HTMLをNodeヒープ160MB上限で解析する試験が成功。
- 初期IPCの分断による停止を修正し、誤って失敗扱いにした3件を再処理。修正後に約2,900件を連続処理しました。サービス再起動のSIGTERMを子プロセスへ同時送信しないKillMode=mixedを設定し、保存位置を保って継続することを実サービスで確認。
- 差分取り込み後、既存のローカルD1 override全件とアバター行が保持されていることを比較確認。小物一覧1,403件をローカルAPIで確認。
- 移行前のJSON・D1をバックアップして整合性確認。VPSの実DBでもSQLiteオンラインバックアップを複数回作成。復元は隔離DBで検証済み。本番の全面ロールバックは実行していません。
- プログラム・DBは専用ユーザーとディレクトリに分離し、当サービスとバックアップタイマーの自動起動を確認。待受ポートは移行前後ともSSHとローカルDNSのみ。空きディスク約87GB。

ローカルの `data/progress-full-accessories.json` は切り替え時点で止まります。移行後の進捗は `scripts/vps-collector.ps1 status` またはVPSのprogress.jsonを確認してください。
