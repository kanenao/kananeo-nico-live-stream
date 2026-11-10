# kananeo nico live stream

総合ニコ生管理デスクトップアプリの独自プロジェクトです。

## 現在のバージョン

**0.1.0-beta.4** — NDGRコメント受信とコメントビューアを追加しました。

## β4で追加した機能

- ニコニコ公式ログイン専用セッションを利用したコメント接続
- 現行NDGRコメントストリームを利用したリアルタイム受信
- 過去コメント（バックログ）の取得ON/OFF
- コメント、放送者コメント、ギフト、エモーション、通知の受信
- 接続状態の表示とprovider側の自動再接続
- コメント検索、種別フィルター、コピー、CSV保存
- 表示件数の上限（最大1,000件）
- Cookie値、WebSocket URL、raw Protobufを画面やログへ出さない
- NDGR接続先のallowlist検証と単体テスト

## β2 / β3から引き継いだ機能

- 動画リクエストキューの追加・順番変更・削除
- 自動アンケートの待ち時間・結果表示時間・判定ルールの保存
- 次枠・自動延長の設定値保存
- OBS / N Air / XSplit の実行パス設定
- BGMプレイリスト、NGワード、NGユーザー
- 設定JSONの書き出し・読み込み
- ニコニコ公式ログイン画面を専用セッションで開く
- 放送ID / URLの検証、番組ページ情報確認

## 起動方法

1. Node.js 20以降をインストール
2. プロジェクトルートで `npm install`
3. `npm test`
4. `npm start`

## コメント受信手順

1. 「放送・枠管理」からニコニコ公式ログインを行います。
2. 「コメントビューア」で放送IDまたは番組URLを入力します。
3. 必要に応じて「過去コメントも取得」を有効にします。
4. 「コメント受信を開始」を押します。
5. 検索・種別フィルター・コピー・CSV保存が使えます。

## 技術・依存ライブラリ

- Electron 45.2.3
- [nicomget](https://github.com/Segu-g/nicomget) 2.2.4（MIT）
- [@n-air-app/nicolive-comment-protobuf](https://github.com/Segu-g/nicolive-comment-protobuf)互換のprotobuf定義（MIT）

依存ライブラリはコミットSHAで固定しています。詳細な著作権・ライセンス表示は `THIRD_PARTY_NOTICES.md` を参照してください。

## 重要：β4でも未実装の機能

コメント受信は視聴用WebSocketとNDGRメッセージストリームを使用しますが、コメント送信・運営コメント送信、アンケート作成・結果API、番組作成、次枠、無料延長、OBS等の外部操作は未実装です。コメント接続の成功は配信主権限を意味しません。

本版では実アカウント・実放送を使った統合試験はまだ実施していません。接続仕様の変更によって動作しない場合があります。

## 認証とプライバシー

メールアドレス・パスワードをアプリが直接送る旧方式は実装しません。ニコニコ公式Webログインを専用Electronセッションで開きます。普段使いのChrome / EdgeのCookieを読み取りません。セッションから読み取ったCookieはメインプロセス内だけで利用し、画面・ログ・CSV・GitHubへ出力しません。

## 参考資料

- [NDGRClient](https://github.com/tsukumijima/NDGRClient)：現行NDGRのHTTPストリーミング / Protobuf方式の参考
- [nicomget](https://github.com/Segu-g/nicomget)：Node.jsのNDGRコメント受信層
- [NdgrClientSharp](https://github.com/TORISOUP/NdgrClientSharp)：NDGR API構成の参考

参考プロジェクトの画面・画像・実行ファイルを複製していません。利用ライブラリは各ライセンスに従います。

詳細：`docs/NICONICO_CONNECTION.md`, `docs/NDGR_COMMENTS.md`, `docs/REFERENCE_ANALYSIS.md`, `docs/ROADMAP.md`
