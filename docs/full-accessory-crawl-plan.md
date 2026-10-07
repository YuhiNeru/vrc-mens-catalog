# 小物の全ページ収集計画

開始：2026-10-08 JST。実行IDと最終更新日時は data/progress-full-accessories.json に保存。

今回の「全取得」は、次の検索範囲について、BOOTHの次ページがなくなるまで巡回し、発見した全商品IDを重複排除して商品ページを取得することです。検索語ごとの7件上限やページ数の打ち切りはありません。BOOTHの全商品や未公開商品までの網羅を意味するものではありません。

- [3D装飾品カテゴリ全体](https://booth.pm/ja/browse/3D%E8%A3%85%E9%A3%BE%E5%93%81?sort=new)：初期照会26,880件（2026-10-08 JST。照会HTML data/raw/full-accessory-probe-all.html）。特定の男性名・VRChatタグに限定せず、汎用品や別名の商品も発見します。
- 衣装カテゴリに登録された小物：日本語・英語の66検索語について全ページ取得。語一覧は src/cli/full-accessory-review.ts の accessorySearchTerms。計67検索起点。
- 保存済みの商品ページは取得日時を保って再利用。新規商品ページを全件取得し、作者の対応一覧・販売対象版を照合。
- 男性アバターへの対応が確認できた単独小物を分類してローカルD1へ順次反映。衣装・髪型とのセット、素材・ツール、撮影モデルへの言及だけでは小物として自動掲載しません。
- 商品画像はBOOTHの画像URLを直接使用。商品データと対応根拠を保存し、終了時にスキ数を更新。

初期所要時間見込み：3〜5日。検索結果の全ページ走査と重複排除を終えるまで確定的な終了時刻は不明。

取得は3秒間隔、並列1件。robots.txtを確認し、401/403・アクセスchallenge・巡回異常で停止します。429のRetry-Afterを守ります。日次12,000リクエストに達した場合は翌日00:01 JST以降に自動再開。PCの起動・ネット接続が必要です。

## 進捗・結果

- data/progress-full-accessories.json：軽量な進捗、段階、待機・停止理由。
- data/full-accessories/state.json：ページ単位と商品単位の再開位置。
- data/logs/full-accessories.log / full-accessories-error.log：実行ログ。
- data/full-accessories/result.json：完了時の全取得範囲・取得不能一覧・追加件数。
- docs/full-accessory-crawl-result.md：完了時に自動生成する結果報告。

プロセス終了やPC再起動後は、稼働状況と data/crawler.lock を確認してから `npx tsx scripts/collect-full-accessories.ts` で再開します。同時起動はロックにより拒否されます。

型チェックおよびテスト30件成功後に、非表示のバックグラウンドプロセスとして開始。PIDは data/full-accessory-process.json。
