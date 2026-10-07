# 男女兼用小物の追加

確認日時: 2026-10-08T03:30:05.7240999+09:00

男性アバターへの確認済み対応がある男女兼用衣装から、小物候補88件を抽出。商品名と保存済み作者説明を確認し、単独の小物74件を分別。衣装セット12件と分類保留2件は移動しない。既存10件と合計84件を小物フロアで表示。メンズ衣装は422件で維持し、男女兼用衣装は非表示のまま。アバターの小物件数と詳細の小物欄は男女兼用を合算する。

小物84件のスキ数を再取得（robots含め5リクエスト）。全件取得済み、男性への確認済み対応あり。設定は config/accessory-classification.json に保存し、将来の再クロールでも分類を保持する。

取得元API: http://localhost:8787/api/products?kind=accessory 、 ?kind=accessory&audience=men （10件）、 ?kind=accessory&audience=unisex （74件）。

| 商品ID | 商品名 | カテゴリ | 区分 | 商品取得日時UTC | 取得元 |
|---|---|---|---|---|---|
| 7728424 | 「simulacrum shoes」3D衣装モデル　(lapwing、当ショップアバター対応） | 靴・レッグウェア | unknown | 2026-10-07T05:13:11.226Z | https://booth.pm/ja/items/7728424 |
| 7143171 | 口枷【Velno専用】 | 口元小物 | unknown | 2026-10-07T03:52:40.156Z | https://booth.pm/ja/items/7143171 |
| 6924467 | スチームパンク風 パイロットゴーグル / Steampank Pilot google | 眼鏡・ゴーグル | unknown | 2026-10-07T03:51:14.236Z | https://booth.pm/ja/items/6924467 |
| 3328879 | シューズ＆ソックス（UC-S01～UC-S02） | 靴・レッグウェア | unknown | 2026-10-07T02:52:57.850Z | https://booth.pm/ja/items/3328879 |
| 4393291 | ９アバター 対応　Leather boots | 靴・レッグウェア | unisex | 2026-10-07T02:52:14.201Z | https://booth.pm/ja/items/4393291 |
| 4602726 | 複数アバター対応「L＆L Boots」 | 靴・レッグウェア | unisex | 2026-10-07T02:51:45.935Z | https://booth.pm/ja/items/4602726 |
| 4744789 | 12アバター 対応　Long boots | 靴・レッグウェア | unisex | 2026-10-07T02:51:40.120Z | https://booth.pm/ja/items/4744789 |
| 6509502 | 12アバター 対応　high heel sneakers | 靴・レッグウェア | unisex | 2026-10-07T02:50:11.011Z | https://booth.pm/ja/items/6509502 |
| 7230751 | 13アバター 対応　Long boots 2 | 靴・レッグウェア | unisex | 2026-10-07T02:49:56.018Z | https://booth.pm/ja/items/7230751 |
| 7084711 | 『18アバター対応』 ハイカットスニーカー High Top Sneakers  | 靴・レッグウェア | unisex | 2026-10-07T02:48:39.826Z | https://booth.pm/ja/items/7084711 |
| 5074372 | BECKENZI HightTop Sneaker/ハイトップスニーカー [29アバタ/Avatars] | 靴・レッグウェア | unisex | 2026-10-07T02:47:18.114Z | https://booth.pm/ja/items/5074372 |
| 5736487 | 💥33% OFFアップデートセール🏷️ BECKENZI ゴスグローブ/Goth Gloves [26+アバタ/Avatars] | 手袋 | unisex | 2026-10-07T02:46:59.023Z | https://booth.pm/ja/items/5736487 |
| 7127567 | 【複数アバター対応】モノクローマローゼンヒール・Monochroma Rozen Heel | 靴・レッグウェア | unisex | 2026-10-07T02:44:37.770Z | https://booth.pm/ja/items/7127567 |
| 7330021 | 真央-mao- 対応 [One-piece Stockings] | 靴・レッグウェア | unknown | 2026-10-07T02:43:34.676Z | https://booth.pm/ja/items/7330021 |
| 7472420 | BECKENZI Zipper Navel Piercing/ジッパーへそピアス [21+アバタ/Avatars] | ピアス | unisex | 2026-10-07T02:42:37.064Z | https://booth.pm/ja/items/7472420 |
| 7641936 | ⌜⌜⌜Martin Boots⌟⌟⌟↓⌜⌜⌜19アバター対応⌟⌟⌟🐦‍⬛ | 靴・レッグウェア | unisex | 2026-10-07T02:41:57.314Z | https://booth.pm/ja/items/7641936 |
| 7841368 | BECKENZI Thigh Highs/サイハイソックス 🧦[25+アバタ/Avatars] | 靴・レッグウェア | unisex | 2026-10-07T02:40:48.247Z | https://booth.pm/ja/items/7841368 |
| 7882369 | 複数アバター対応 Stockings | 靴・レッグウェア | unisex | 2026-10-07T02:40:34.860Z | https://booth.pm/ja/items/7882369 |
| 7911533 | 『 Onyx heels 』  8 アバター対応  | 靴・レッグウェア | unisex | 2026-10-07T02:40:20.557Z | https://booth.pm/ja/items/7911533 |
| 8032774 | 【複数アバター対応】ニーソックス＆サイハイソックス【色変え簡単】 | 靴・レッグウェア | unisex | 2026-10-07T02:39:30.234Z | https://booth.pm/ja/items/8032774 |
| 8145736 | かわいく揺れる！地雷系ネイル🖤Poison Candy🖤 | ネイル・指輪 | unisex | 2026-10-07T02:38:49.462Z | https://booth.pm/ja/items/8145736 |
| 8503513 | [28 - Avatars] - Mikki Punk Boots | 靴・レッグウェア | unisex | 2026-10-07T02:37:00.139Z | https://booth.pm/ja/items/8503513 |
| 8500435 | 【21モデル対応】シンプルニーソックス - Simple Thigh Highs For 21 Avatars | 靴・レッグウェア | unisex | 2026-10-07T02:36:48.333Z | https://booth.pm/ja/items/8500435 |
| 8645706 | 39アバター対応 Lucent Glass Nail | ネイル・指輪 | unisex | 2026-10-07T02:35:55.491Z | https://booth.pm/ja/items/8645706 |
| 3622109 | 【29アバター対応】サンダルA&B（lilToon対応版） | 靴・レッグウェア | unisex | 2026-10-07T02:31:19.808Z | https://booth.pm/ja/items/3622109 |
| 5902039 | [VRChat] 人魚の尻尾 ※6アバター対応※【3Dモデル】 | 耳・尻尾 | unisex | 2026-10-07T02:14:22.823Z | https://booth.pm/ja/items/5902039 |
| 6016005 | ［5アバター対応］帽子２種＋ヘア付！Hatmaker  -Unusual- | 帽子 | unisex | 2026-10-07T02:14:21.600Z | https://booth.pm/ja/items/6016005 |
| 8806619 | 【12モデル対応】アームハーネス - Arm Straps for 12 Avatars | ハーネス | unisex | 2026-10-07T01:16:38.212Z | https://booth.pm/ja/items/8806619 |
| 8786274 | 【12モデル対応】レッグハーネス - Thigh Straps for 12 Avatars | ハーネス | unisex | 2026-10-07T01:16:32.240Z | https://booth.pm/ja/items/8786274 |
| 8360193 | 【VRC想定14アバター対応】元ねじ職人がつくる”木下地板金ビスピアス”（商用利用可） | ピアス | unisex | 2026-10-07T01:16:17.464Z | https://booth.pm/ja/items/8360193 |
| 8371838 | 【VRC想定・MAで14アバター対応】花札ピアス | ピアス | unisex | 2026-10-07T01:16:11.592Z | https://booth.pm/ja/items/8371838 |
| 8404584 | 【VRC想定・14アバター対応】切子硝子ピアス-宵硝子- | ピアス | unisex | 2026-10-07T01:15:53.120Z | https://booth.pm/ja/items/8404584 |
| 8420319 | 【VRC想定・14アバター調整済み】ハーフマスク”八咫烏-YATAGARASU-（商用利用可） | マスク | unisex | 2026-10-07T01:15:41.361Z | https://booth.pm/ja/items/8420319 |
| 6484778 | [複数対応]ぷにぷに！肉球ニーハイソックス | 靴・レッグウェア | unisex | 2026-10-07T00:15:41.739Z | https://booth.pm/ja/items/6484778 |
| 8807415 | 【VRC想定・MA】11アバター対応　Metalplate Boots | 靴・レッグウェア | unisex | 2026-10-07T00:15:15.656Z | https://booth.pm/ja/items/8807415 |
| 6215348 | フォシュニアのスニーカー | 靴・レッグウェア | unknown | 2026-10-07T00:13:41.509Z | https://booth.pm/ja/items/6215348 |
| 6008638 | 【9アバター対応】オーバーニーソックス | 靴・レッグウェア | unisex | 2026-10-07T00:11:56.463Z | https://booth.pm/ja/items/6008638 |
| 5266355 | 多機能マスク PB + MA+9 AVATAR対応 | マスク | unisex | 2026-10-07T00:09:41.008Z | https://booth.pm/ja/items/5266355 |
| 5510907 | 動ける Eye Mask  8 Avatars 対応 | マスク | unisex | 2026-10-07T00:09:33.903Z | https://booth.pm/ja/items/5510907 |
| 5514245 | 動ける電波Mask (TypeB)  PB + MA + 8 Avatars対応 | マスク | unisex | 2026-10-07T00:09:31.851Z | https://booth.pm/ja/items/5514245 |
| 5809651 | 【靴】猫々温泉 ニーハイ&チャイナシューズ v1.7 | 靴・レッグウェア | unisex | 2026-10-07T00:09:27.566Z | https://booth.pm/ja/items/5809651 |
| 5747952 | 【オリジナル3Dモデル】AXIS ORIGIN NW-2404【アバター対応靴】 | 靴・レッグウェア | unisex | 2026-10-07T00:07:54.737Z | https://booth.pm/ja/items/5747952 |
| 5158342 | 【+Head用】AIT_Kalne's_Leather_Glove | 手袋 | unknown | 2026-10-06T23:56:56.873Z | https://booth.pm/ja/items/5158342 |
| 7640032 | [22 - Avatars] Metrobeat Sneaker | 靴・レッグウェア | unisex | 2026-10-06T23:33:01.490Z | https://booth.pm/ja/items/7640032 |
| 7660759 | [22 - Avatars] Kirei Hane Sneaker | 靴・レッグウェア | unisex | 2026-10-06T23:33:00.859Z | https://booth.pm/ja/items/7660759 |
| 7811253 | 【11アバター+α対応】あったかもこふわソックス【VRChat】 | 靴・レッグウェア | unisex | 2026-10-06T23:32:52.444Z | https://booth.pm/ja/items/7811253 |
| 7790132 | やわこーぎーモチーフの帽子 | 帽子 | unisex | 2026-10-06T23:31:03.093Z | https://booth.pm/ja/items/7790132 |
| 7374794 | 厚底レイヤードソール -Layered Sole Sneaker- | 靴・レッグウェア | unisex | 2026-10-06T23:29:12.927Z | https://booth.pm/ja/items/7374794 |
| 7956559 | ~10/15 SALE🤍obake nail 【16アバター対応】 | ネイル・指輪 | unisex | 2026-10-06T23:28:39.128Z | https://booth.pm/ja/items/7956559 |
| 4691866 | [ Gothic Punk Gloves ] | 手袋 | unisex | 2026-10-06T23:27:38.084Z | https://booth.pm/ja/items/4691866 |
| 5161445 | ネイルチップ♡13アバター対応＆MA対応 | ネイル・指輪 | unisex | 2026-10-06T23:10:29.106Z | https://booth.pm/ja/items/5161445 |
| 5261674 | 【7アバター対応】スクランパ―(牙ピアス)【MA対応】 | ピアス | unisex | 2026-10-06T23:10:22.287Z | https://booth.pm/ja/items/5261674 |
| 5293281 | 【6アバター対応】お薬カプセル舌ピアス【MA対応】 | ピアス | unisex | 2026-10-06T23:10:19.998Z | https://booth.pm/ja/items/5293281 |
| 5502724 | 魚が泳ぐ✨アクアリウムシューズ | 靴・レッグウェア | unisex | 2026-10-06T23:09:13.870Z | https://booth.pm/ja/items/5502724 |
| 5693647 | デニムネイル -DENIM　NEIL- （7アバター対応・MA対応） | ネイル・指輪 | unisex | 2026-10-06T23:08:44.866Z | https://booth.pm/ja/items/5693647 |
| 6219261 | いい感じにおしゃれになるマスク【26アバター対応/MA対応】 | マスク | unisex | 2026-10-06T23:07:29.082Z | https://booth.pm/ja/items/6219261 |
| 6303503 | 🦊「10アバター対応」🦊 Fox Tail, Ear, Hand | 耳・尻尾 | unisex | 2026-10-06T23:07:17.020Z | https://booth.pm/ja/items/6303503 |
| 6311498 | 【50アバター対応】涙メガネ　#NOWA_shop | 眼鏡・ゴーグル | unisex | 2026-10-06T23:07:12.386Z | https://booth.pm/ja/items/6311498 |
| 6859140 | Urbanスニーカー 3Dモデル【VRChat対応／10アバター】 | 靴・レッグウェア | unisex | 2026-10-06T23:05:32.593Z | https://booth.pm/ja/items/6859140 |
| 6911880 | Techスニーカー 3Dモデル【VRChat対応／10アバター】 | 靴・レッグウェア | unisex | 2026-10-06T23:05:23.457Z | https://booth.pm/ja/items/6911880 |
| 6971138 | 【男性アバター向け】タイツセット【タイツ/ニーハイ/レギンスetc】 | 靴・レッグウェア | unknown | 2026-10-06T23:05:03.353Z | https://booth.pm/ja/items/6971138 |
| 6988583 | 『MA 10アバター対応！』VRChat想定ピアス Punk ON👽 | ピアス | unisex | 2026-10-06T23:04:53.473Z | https://booth.pm/ja/items/6988583 |
| 7037921 | 🖤 Techwearスニーカー 3Dモデル【VRChat対応／15アバター】 | 靴・レッグウェア | unisex | 2026-10-06T23:04:44.104Z | https://booth.pm/ja/items/7037921 |
| 7147202 | 【VRChat想定】Tracer(トレーサー) / スニーカー【6アバター対応】 | 靴・レッグウェア | unisex | 2026-10-06T23:03:55.531Z | https://booth.pm/ja/items/7147202 |
| 7217133 | 【4アバター対応】シンプルボディピアス 人耳ver.【MA設定済】 | ピアス | unisex | 2026-10-06T23:03:50.653Z | https://booth.pm/ja/items/7217133 |
| 7302591 | 【VRChat想定】Mojito(モヒート) / サンダルスニーカー【6アバター対応】 | 靴・レッグウェア | unisex | 2026-10-06T23:03:17.532Z | https://booth.pm/ja/items/7302591 |
| 7532104 | 【VRChat向け3Dネイル】LS_Nail02💎◆ | ネイル・指輪 | unisex | 2026-10-06T23:02:09.044Z | https://booth.pm/ja/items/7532104 |
| 7431152 | Wugi-Bugi(ウギー・ブギー) / スニーカーローファー【8アバター対応】 | 靴・レッグウェア | unisex | 2026-10-06T23:01:55.310Z | https://booth.pm/ja/items/7431152 |
| 7745564 | 【MA対応指輪セット】『PICK ME UP』VRChat向けアクセサリー | ネイル・指輪 | unisex | 2026-10-06T23:00:56.617Z | https://booth.pm/ja/items/7745564 |
| 8040632 | body pierced+necklace/ZEPTO002【水瀬/狛乃/斑霞/zev対応】 | 首元アクセサリー | unisex | 2026-10-06T22:59:12.552Z | https://booth.pm/ja/items/8040632 |
| 7981193 | Poison devil nail | ネイル・指輪 | unisex | 2026-10-06T22:59:11.667Z | https://booth.pm/ja/items/7981193 |
| 8413069 | Secret Doll Nail | ネイル・指輪 | unisex | 2026-10-06T22:57:29.680Z | https://booth.pm/ja/items/8413069 |
| 8510284 | 【靴 Outfit 】ハイカット |【VRStars Converse】 | 靴・レッグウェア | unisex | 2026-10-06T22:57:12.664Z | https://booth.pm/ja/items/8510284 |
| 5359242 | 5アバター対応∴knee-high boots | 靴・レッグウェア | unknown | 2026-10-06T22:54:13.624Z | https://booth.pm/ja/items/5359242 |
| 6541824 | 【10アバター対応】Fluffy Cat Paw Socks | ふわふわ猫の足ソックス | 靴・レッグウェア | unisex | 2026-10-06T22:51:48.024Z | https://booth.pm/ja/items/6541824 |
| 6602706 | 【複数アバター対応】トゲトゲ首輪 | 首元アクセサリー | unisex | 2026-10-06T22:51:28.112Z | https://booth.pm/ja/items/6602706 |
| 6659321 | 【複数アバター対応】おなじみのピアス | ピアス | unisex | 2026-10-06T22:51:10.568Z | https://booth.pm/ja/items/6659321 |
| 6782875 | ♞ LEATHER BOOTS♞ | 靴・レッグウェア | unisex | 2026-10-06T22:50:50.483Z | https://booth.pm/ja/items/6782875 |
| 6783070 | ♘LEATHER SQUARE BAG♘ | バッグ | unisex | 2026-10-06T22:50:49.774Z | https://booth.pm/ja/items/6783070 |
| 6936346 | 【51アバター対応】舌ピアス（MA設定済み＆セットアップツール付） | ピアス | unisex | 2026-10-06T22:50:14.638Z | https://booth.pm/ja/items/6936346 |
| 7409673 | 【複数アバター対応】おなじみのブレスレット | ブレスレット | unisex | 2026-10-06T22:48:27.398Z | https://booth.pm/ja/items/7409673 |
| 7524036 | 【47アバター対応】口ピアス（MA設定済み＆セットアップツール付） | ピアス | unisex | 2026-10-06T22:47:37.867Z | https://booth.pm/ja/items/7524036 |
| 8546837 | 星海月（ほしくらげ）のピアス  | ピアス | unisex | 2026-10-06T22:42:33.753Z | https://booth.pm/ja/items/8546837 |
| 8936500 | 泣夜専用Neck_Lace | 首元アクセサリー | unknown | 2026-10-06T22:22:07.898Z | https://booth.pm/ja/items/8936500 |