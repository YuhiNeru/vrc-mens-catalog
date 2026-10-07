# 男性アバターフロアへの全候補照合と反映

77候補をBOOTH本体と衣装作者の男性・女性対象一覧で照合し、男性モデルとして確認できた全件を登録した。掲載本体合計98体、今回追加47体。男性向け衣装を着せられることだけで女性本体を男性アバターと判定しない。男女セットのリオは作者が男性と明記するLioのみ登録。熨斗目旧モデルと熨斗目:Reを区別した。画像はBOOTHの元URLを使用。

照合結果：{"unavailable":8,"published":47,"gender-review":21,"insufficient-evidence":1}。404は現在販売中とせず、性別の根拠不足・女性版との分類矛盾は保留。共通素体はアバター本体として追加しない。

反映後の確認日時：2026-10-07 10:52:31 JST。確認済み男性アバターは衣装対応件数が0件でもフロアに表示する。

| 公開対象 | 件数 | 取得元 |
|---|---:|---|
| 男性アバター | 98体 | http://127.0.0.1:8787/api/avatars |
| 通常衣装 | 840件 | http://127.0.0.1:8787/api/products |
| 男女兼用衣装（別枠） | 880件 | http://127.0.0.1:8787/api/products?audience=unisex |

本体ページは3秒間隔・逐次取得で照合し、robotsとアクセス制限を遵守した。保存済み衣装の対応を再照合してローカルD1に反映。型チェック、19件のテスト、PC・モバイルのフロア表示、衣装の絞り込み・男女兼用枠・BOOTH画像URLの表示を確認済み。ここでの「全件」は今回抽出した77候補のうち男性モデルとして確認できた全件で、BOOTH全体の網羅を意味しない。

| 候補 | 結果 | 出典 | 確認日時（UTC） | 根拠・保留理由 |
|---|---|---|---|---|
| 水瀬 VRChat向けアバター #Minase3D | unavailable | [BOOTH](https://booth.pm/ja/items/4013951) | 2026-10-07T01:41:22.259Z | HTTP 404; preserve previous record |
| ドラゴニュート・ヴラウ | published | [BOOTH](https://booth.pm/ja/items/4169438) | 2026-10-07T01:41:25.254Z | 衣装作者の男性向け対応対象「◇Men'sAvatar◇」に本体URLを確認。https://booth.pm/ja/items/7018110 |
| ひゃっこ | published | [BOOTH](https://booth.pm/ja/items/8205244) | 2026-10-07T01:41:28.339Z | 衣装作者の男性向け対応対象「※男性アバター向け衣装は以下URLをご覧ください。」に本体URLを確認。https://booth.pm/ja/items/8176384 |
| 獏 | published | [BOOTH](https://booth.pm/ja/items/8017433) | 2026-10-07T01:41:31.326Z | 衣装作者の男性向け対応対象「メンズ」に本体URLを確認。https://booth.pm/ja/items/8514906 |
| 碼希-まき- | published | [BOOTH](https://booth.pm/ja/items/3162696) | 2026-10-07T01:41:34.224Z | 衣装作者の男性向け対応対象「■対応アバター（Men's）※セミ対応」に本体URLを確認。https://booth.pm/ja/items/7110662 |
| リオ | published | [BOOTH](https://booth.pm/ja/items/4168378) | 2026-10-07T01:41:37.267Z | 本体作者が「リオ-Lio- 男の子のモデルです」と明記。本商品はサクヤ（女性）とのセット・単体売りがあるため、男性モデルのLio版を選んでください。https://booth.pm/ja/items/4168378 |
| 相楽 | published | [BOOTH](https://booth.pm/ja/items/3856749) | 2026-10-07T01:41:40.369Z | 衣装作者の男性向け対応対象「■対応アバター（Men's）※セミ対応」に本体URLを確認。https://booth.pm/ja/items/7110662 |
| 雫峰 | published | [BOOTH](https://booth.pm/ja/items/7684873) | 2026-10-07T01:41:43.394Z | 衣装作者の男性向け対応対象「第一弾として「男性アバター向け衣装」をテーマに6名のクリエイターが参加しています（今後プログラム参加クリエイターを幅広く募集予定）」に本体URLを確認。https://booth.pm/ja/items/6515488 |
| アル | published | [BOOTH](https://booth.pm/ja/items/2174830) | 2026-10-07T01:41:46.323Z | 衣装作者の男性向け対応対象「対応アバター（Men's）※セミ対応」に本体URLを確認。https://booth.pm/ja/items/5735729 |
| 楽 | published | [BOOTH](https://booth.pm/ja/items/3216357) | 2026-10-07T01:41:49.340Z | 衣装作者の男性向け対応対象「対応アバター（Men's）※セミ対応」に本体URLを確認。https://booth.pm/ja/items/5735729 |
| 瀬羽くん | published | [BOOTH](https://booth.pm/ja/items/2017336) | 2026-10-07T01:41:52.289Z | 衣装作者の男性向け対応対象「対応アバター（Men's）※セミ対応」に本体URLを確認。https://booth.pm/ja/items/5735729 |
| Lapwing | gender-review | [BOOTH](https://booth.pm/ja/items/4993931) | 2026-10-07T01:41:55.292Z | 衣装作者が女性版対象としても記載。男性アバター本体の明示がないため保留。https://booth.pm/ja/items/8766806 |
| 伊依 | published | [BOOTH](https://booth.pm/ja/items/6958479) | 2026-10-07T01:41:58.306Z | 衣装作者の男性向け対応対象「メンズアバターの下着って少ないよね！ということで、おしゃれなボクサーパンツを作りました。」に本体URLを確認。https://booth.pm/ja/items/8199081 |
| ハウラ | published | [BOOTH](https://booth.pm/ja/items/3173031) | 2026-10-07T01:42:01.440Z | 衣装作者の男性向け対応対象「対応アバター（Men's）※セミ対応」に本体URLを確認。https://booth.pm/ja/items/5735729 |
| 『弥凪（ミナギ）』 #Minagi3D | gender-review | [BOOTH](https://booth.pm/ja/items/8185892) | 2026-10-07T01:42:04.341Z | 静かな街の片隅で、穏やかに生きる少女。 |
| 【3Dmodel】悪魔リーマン【VRChat avatar】 | published | [BOOTH](https://booth.pm/ja/items/4930863) | 2026-10-07T01:42:07.354Z | 衣装作者の男性向け対応対象「【メンズ】」に本体URLを確認。https://booth.pm/ja/items/8549735 |
| 釉依 | published | [BOOTH](https://booth.pm/ja/items/8198897) | 2026-10-07T01:42:10.489Z | 衣装作者の男性向け対応対象「※男性アバター向け衣装は以下URLをご覧ください。」に本体URLを確認。https://booth.pm/ja/items/8176384 |
| バートランドReNew | published | [BOOTH](https://booth.pm/ja/items/6084131) | 2026-10-07T01:42:13.446Z | ・【オリジナル3Dモデル】彼方-Kanata-＆此方-Konata-　 #BLUESTELLA　男性アバター |
| ひゅーじょん君 オリジナル3Dモデル -VRChatアバター & VRM & 追加衣装 | published | [BOOTH](https://booth.pm/ja/items/4352025) | 2026-10-07T01:42:16.352Z | ✦ ひゅーじょん君 ✦　VRC対応&VRM 男の子アバター |
| 『ひゃっこ』 - by Niyami | unavailable | [BOOTH](https://booth.pm/ja/items/6328134) | 2026-10-07T01:42:19.295Z | HTTP 404; preserve previous record |
| オリジナル3Dモデル ｢エリオン｣ | published | [BOOTH](https://booth.pm/ja/items/4640002) | 2026-10-07T01:42:22.417Z | 衣装作者の男性向け対応対象「第一弾として「男性アバター向け衣装」をテーマに6名のクリエイターが参加しています（今後プログラム参加クリエイターを幅広く募集予定）」に本体URLを確認。https://booth.pm/ja/items/6515488 |
| わん太 | published | [BOOTH](https://booth.pm/ja/items/6712612) | 2026-10-07T01:42:25.395Z | 衣装作者の男性向け対応対象「第一弾として「男性アバター向け衣装」をテーマに6名のクリエイターが参加しています（今後プログラム参加クリエイターを幅広く募集予定）」に本体URLを確認。https://booth.pm/ja/items/6515488 |
| 杏里 オリジナル3Dモデル #Anri3D | unavailable | [BOOTH](https://booth.pm/ja/items/3203894) | 2026-10-07T01:42:28.313Z | HTTP 404; preserve previous record |
| 加須谷 Kasuya | published | [BOOTH](https://booth.pm/ja/items/3987935) | 2026-10-07T01:42:31.445Z | 衣装作者の男性向け対応対象「◇Men'sAvatar◇」に本体URLを確認。https://booth.pm/ja/items/7018110 |
| #Menno3D | published | [BOOTH](https://booth.pm/ja/items/6504220) | 2026-10-07T01:42:34.404Z | 衣装作者の男性向け対応対象「· ﻿· ﻿· ﻿· ✦対応アバター　メンズ✦· ﻿· ﻿· ﻿·」に本体URLを確認。https://booth.pm/ja/items/8766806 |
| ノイズ（noiz）RE | published | [BOOTH](https://booth.pm/ja/items/7744394) | 2026-10-07T01:42:37.447Z | 衣装作者の男性向け対応対象「【メンズ】」に本体URLを確認。https://booth.pm/ja/items/8857545 |
| 断罪（DANZAI）RE | published | [BOOTH](https://booth.pm/ja/items/8200327) | 2026-10-07T01:42:40.474Z | 衣装作者の男性向け対応対象「【メンズ】」に本体URLを確認。https://booth.pm/ja/items/8857545 |
| 愛莉 | gender-review | [BOOTH](https://booth.pm/ja/items/6082686) | 2026-10-07T01:42:43.459Z | 衣装作者が女性版対象としても記載。男性アバター本体の明示がないため保留。https://booth.pm/ja/items/8932196 |
| 森羅 オリジナル3Dモデル #Shinra3D | unavailable | [BOOTH](https://booth.pm/ja/items/4707634) | 2026-10-07T01:42:46.344Z | HTTP 404; preserve previous record |
| エシュラン | published | [BOOTH](https://booth.pm/ja/items/5025863) | 2026-10-07T01:42:49.444Z | ちょっぴりミステリアス、それでいてどこかコミカルなお兄さんアバターです。 |
| 成犬バルト | published | [BOOTH](https://booth.pm/ja/items/5091727) | 2026-10-07T01:42:52.765Z | 衣装作者の男性向け対応対象「第一弾として「男性アバター向け衣装」をテーマに6名のクリエイターが参加しています（今後プログラム参加クリエイターを幅広く募集予定）」に本体URLを確認。https://booth.pm/ja/items/6693748 |
| バルト | published | [BOOTH](https://booth.pm/ja/items/4555823) | 2026-10-07T01:42:55.609Z | 90年代アニメチックキャラクターをイメージした、救助隊に所属しているアラスカンマラミュートの男の子です。 |
| 依綱 | published | [BOOTH](https://booth.pm/ja/items/3940398) | 2026-10-07T01:42:58.548Z | 肉体美が自慢の男性アバターモデルです。 |
| 【3Dmodel】天使リーマン【VRChat avatar】 | published | [BOOTH](https://booth.pm/ja/items/3641986) | 2026-10-07T01:43:01.463Z | 衣装作者の男性向け対応対象「· ﻿· ﻿· ﻿· ✦対応アバター　メンズ✦· ﻿· ﻿· ﻿·」に本体URLを確認。https://booth.pm/ja/items/8766806 |
| ヴェルノ | published | [BOOTH](https://booth.pm/ja/items/6226092) | 2026-10-07T01:43:04.444Z | 衣装作者の男性向け対応対象「【メンズ】」に本体URLを確認。https://booth.pm/ja/items/8857545 |
| 【LilLeo-リルレオ-】オリジナル3Dモデル | gender-review | [BOOTH](https://booth.pm/ja/items/7374627) | 2026-10-07T01:43:07.472Z | 衣装作者が女性版対象としても記載。男性アバター本体の明示がないため保留。https://booth.pm/ja/items/8857545 |
| アズエド | published | [BOOTH](https://booth.pm/ja/items/7746587) | 2026-10-07T01:43:10.528Z | 衣装作者の男性向け対応対象「メンズアバター向けピエロ衣装です。」に本体URLを確認。https://booth.pm/ja/items/7577301 |
| 輝夜 | gender-review | [BOOTH](https://booth.pm/ja/items/8562330) | 2026-10-07T01:43:13.493Z | 衣装作者が女性版対象としても記載。男性アバター本体の明示がないため保留。https://booth.pm/ja/items/8932196 |
| Alies/荒洲 (アレス) | published | [BOOTH](https://booth.pm/ja/items/5760685) | 2026-10-07T01:43:16.594Z | 軍服風短髪男性アバターです。 |
| Mumus【 | gender-review | [BOOTH](https://booth.pm/ja/items/6951878) | 2026-10-07T01:43:19.452Z | にこにこかわいいネズミの女の子です！ |
| むんき -Munkki - | gender-review | [BOOTH](https://booth.pm/ja/items/5787485) | 2026-10-07T01:43:22.660Z | 衣装作者が女性版対象としても記載。男性アバター本体の明示がないため保留。https://booth.pm/ja/items/8514906 |
| まるぼでぃ【 | gender-review | [BOOTH](https://booth.pm/ja/items/6517448) | 2026-10-07T01:43:25.743Z | 少女と自律型粉砕機の二人組です |
| うささき Usasaki / オリジナル3Dモデル | gender-review | [BOOTH](https://booth.pm/ja/items/3550881) | 2026-10-07T01:43:28.594Z | 衣装作者が女性版対象としても記載。男性アバター本体の明示がないため保留。https://booth.pm/ja/items/7595960 |
| 【オリジナル3D男性モデル】雲隠 雪綱【VRC】 | published | [BOOTH](https://booth.pm/ja/items/3939512) | 2026-10-07T01:43:31.558Z | 衣装作者の男性向け対応対象「第一弾として「男性アバター向け衣装」をテーマに6名のクリエイターが参加しています（今後プログラム参加クリエイターを幅広く募集予定）」に本体URLを確認。https://booth.pm/ja/items/6515488 |
| 『釉依 -YUI-』 #釉依3D #YUI3D / AC4　※胸など素体の揺れ物には対応していません | unavailable | [BOOTH](https://booth.pm/ja/items/7684880) | 2026-10-07T01:43:34.445Z | HTTP 404; preserve previous record |
| 熨斗目（旧モデル） | published | [BOOTH](https://booth.pm/ja/items/4004498) | 2026-10-07T01:43:37.811Z | 本体作者が「VRchat用男性アバター「熨斗目(のしめ)」」と明記。熨斗目:Reとは別の旧モデル。https://booth.pm/ja/items/4004498 |
| 優世 -Yusei- | published | [BOOTH](https://booth.pm/ja/items/6809443) | 2026-10-07T01:43:40.511Z | やや筋肉質で怪しいサラリーマンの男性アバターです。 |
| Toah -トア- | published | [BOOTH](https://booth.pm/ja/items/6836210) | 2026-10-07T01:43:43.542Z | 仮想現実で生きる、どこか儚げな少年です |
| ノクセン | published | [BOOTH](https://booth.pm/ja/items/8804121) | 2026-10-07T01:43:46.580Z | 衣装作者の男性向け対応対象「【メンズ】」に本体URLを確認。https://booth.pm/ja/items/8857545 |
| にゃにゃまる | gender-review | [BOOTH](https://booth.pm/ja/items/8346109) | 2026-10-07T01:43:49.657Z | 衣装作者が女性版対象としても記載。男性アバター本体の明示がないため保留。https://booth.pm/ja/items/8857545 |
| Callsign:[Gifter] | published | [BOOTH](https://booth.pm/ja/items/8376374) | 2026-10-07T01:43:52.525Z | Vrchatでの利用を想定した3Dモデル男性アバターです。 |
| ルティ -Ruty- / オリジナル3Dモデル | published | [BOOTH](https://booth.pm/ja/items/8699929) | 2026-10-07T01:43:55.803Z | 「少年店主」をイメージした男の子アバターです。 |
| ラテ | published | [BOOTH](https://booth.pm/ja/items/8733827) | 2026-10-07T01:43:58.585Z | 可愛さと好奇心旺盛な、天真爛漫な性格が魅力の少年アバター！ |
| ノウル | published | [BOOTH](https://booth.pm/ja/items/3882280) | 2026-10-07T01:44:01.865Z | 犬耳の男の子です。 |
| リウル | published | [BOOTH](https://booth.pm/ja/items/7577702) | 2026-10-07T01:44:04.582Z | 衣装作者の男性向け対応対象「【メンズ】」に本体URLを確認。https://booth.pm/ja/items/8549735 |
| オリジナル3Dモデル ~ネコチヤン~ #ネコチヤン3D #川井商店 | gender-review | [BOOTH](https://booth.pm/ja/items/6584744) | 2026-10-07T01:44:07.617Z | 衣装作者が女性版対象としても記載。男性アバター本体の明示がないため保留。https://booth.pm/ja/items/8549735 |
| Grus | gender-review | [BOOTH](https://booth.pm/ja/items/3190100) | 2026-10-07T01:44:10.687Z | 衣装作者が女性版対象としても記載。男性アバター本体の明示がないため保留。https://booth.pm/ja/items/8857545 |
| オリジナル3Dアバター：Lowtus（ロータス） | gender-review | [BOOTH](https://booth.pm/ja/items/5941406) | 2026-10-07T01:44:13.600Z | 衣装作者が女性版対象としても記載。男性アバター本体の明示がないため保留。https://booth.pm/ja/items/7442656 |
| 山羊のメア -Goat Mea- | published | [BOOTH](https://booth.pm/ja/items/6382745) | 2026-10-07T01:44:16.621Z | 衣装作者の男性向け対応対象「デニムセットにはメンズアバターのくうた/+Headを追加しました。」に本体URLを確認。https://booth.pm/ja/items/8168497 |
| 慧 -Kei- オリジナル3Dモデル | published | [BOOTH](https://booth.pm/ja/items/7806994) | 2026-10-07T01:44:19.614Z | 黒髪眼鏡の男の子「慧」です。主にVRChat向けにご利用できます。 |
| VRChat想定アバター】梔子 ver.2.02 | unavailable | [BOOTH](https://booth.pm/ja/items/4062816) | 2026-10-07T01:44:22.561Z | HTTP 404; preserve previous record |
| VRChat想定アバター】シジ -Remake-　Ver.1.21 | unavailable | [BOOTH](https://booth.pm/ja/items/5362546) | 2026-10-07T01:44:25.584Z | HTTP 404; preserve previous record |
| VRChat想定アバター】煙滅　Ver.1.06 | unavailable | [BOOTH](https://booth.pm/ja/items/5247475) | 2026-10-07T01:44:28.602Z | HTTP 404; preserve previous record |
| 【3D model】シンカイヒトウオ【VRChat avatar】 | gender-review | [BOOTH](https://booth.pm/ja/items/7290300) | 2026-10-07T01:44:31.644Z | 衣装作者が女性版対象としても記載。男性アバター本体の明示がないため保留。https://booth.pm/ja/items/7595960 |
| しまざきくん | published | [BOOTH](https://booth.pm/ja/items/8407161) | 2026-10-07T01:44:34.731Z | 衣装作者の男性向け対応対象「【メンズ】」に本体URLを確認。https://booth.pm/ja/items/7595960 |
| りりか | insufficient-evidence | [BOOTH](https://booth.pm/ja/items/6373683) | 2026-10-07T01:44:37.713Z | 衣装の構成・メンズ版見出しから対象一覧への誤った区分継承を除いたところ、男性対象の根拠が不足 |
| しらつめ Shiratsume / オリジナル3Dモデル | gender-review | [BOOTH](https://booth.pm/ja/items/6831821) | 2026-10-07T01:44:40.668Z | 衣装作者が女性版対象としても記載。男性アバター本体の明示がないため保留。https://booth.pm/ja/items/7144409 |
| ひきくまりのクマリ | gender-review | [BOOTH](https://booth.pm/ja/items/7928592) | 2026-10-07T01:44:43.717Z | 衣装作者が女性版対象としても記載。男性アバター本体の明示がないため保留。https://booth.pm/ja/items/8932196 |
| 海咲-Misaki- | gender-review | [BOOTH](https://booth.pm/ja/items/8325804) | 2026-10-07T01:44:46.704Z | 衣装作者が女性版対象としても記載。男性アバター本体の明示がないため保留。https://booth.pm/ja/items/8606454 |
| Lasyusha〈ラシューシャ〉 | gender-review | [BOOTH](https://booth.pm/ja/items/4825073) | 2026-10-07T01:44:49.681Z | 衣装作者が女性版対象としても記載。男性アバター本体の明示がないため保留。https://booth.pm/ja/items/8203278 |
| PerroBoomWorm | published | [BOOTH](https://booth.pm/ja/items/7748790) | 2026-10-07T01:44:52.756Z | 衣装作者の男性向け対応対象「【男性アバター】」に本体URLを確認。https://booth.pm/ja/items/7825347 |
| nial | published | [BOOTH](https://booth.pm/ja/items/6091717) | 2026-10-07T01:44:55.732Z | 衣装作者の男性向け対応対象「【男性アバター】」に本体URLを確認。https://booth.pm/ja/items/7825347 |
| 萌 | gender-review | [BOOTH](https://booth.pm/ja/items/4667400) | 2026-10-07T01:44:58.674Z | 衣装作者が女性版対象としても記載。男性アバター本体の明示がないため保留。https://booth.pm/ja/items/8932196 |
| イチゴ | gender-review | [BOOTH](https://booth.pm/ja/items/7328789) | 2026-10-07T01:45:01.694Z | 衣装作者が女性版対象としても記載。男性アバター本体の明示がないため保留。https://booth.pm/ja/items/8932196 |
| アデノフォラ | published | [BOOTH](https://booth.pm/ja/items/6731806) | 2026-10-07T01:45:04.880Z | 衣装作者の男性向け対応対象「男性アバター向けのチューブトップとブーツカットパンツのコーデです。」に本体URLを確認。https://booth.pm/ja/items/6274372 |
| SiuSiu / オリジナル3Dモデル | gender-review | [BOOTH](https://booth.pm/ja/items/8426340) | 2026-10-07T01:45:07.720Z | 衣装作者が女性版対象としても記載。男性アバター本体の明示がないため保留。https://booth.pm/ja/items/8932196 |
| 佐々斗勇輝 | published | [BOOTH](https://booth.pm/ja/items/4351466) | 2026-10-07T01:45:10.746Z | 実はみつあみ、狼耳としっぽが特徴の男の子、佐々斗勇輝くんです。 |
