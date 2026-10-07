# アバター詳細のスキ順

2026-10-08 JSTに実装。BOOTH公開商品ページのスキ表示が利用する https://accounts.booth.pm/wish_lists.json の item_ids[] を用いて、表示対象のメンズ衣装432件を取得。認証不要の読み取りのみ。accounts.booth.pm/robots.txt を確認し、24商品ずつ、1秒以上の間隔で取得（robots込み19リクエスト）。432件取得、未取得0件。取得時刻を各商品 likesFetchedAt に保存。

アバター詳細の対応衣装をスキ数の降順に並べる。同数は商品取得日時の新しい順、さらに商品ID順。スキ数が未取得の場合は末尾とし、0件には置き換えない。男女兼用は従来どおり画面に表示しない。衣装カードに取得済みのスキ数を表示する。保存値に基づく順序であり、BOOTH上のリアルタイム値ではない。

再取得: npm run cli -- refresh-likes
ローカル反映: npm run cli -- snapshot-local → npx wrangler d1 execute catalog --local --file data/local-snapshot.sql

商品情報を再クロールしても、スキ数・スキ取得時刻は別途取得されない限り保持する。