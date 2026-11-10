# β4 NDGRコメント受信

## 通信方式

現行のニコニコ生放送コメント取得は、視聴用WebSocketでメッセージサーバーの接続情報を得た後、Protobuf形式のLength-DelimitedメッセージをHTTPストリーミングで受け取るNDGR方式です。旧式のコメント用WebSocket + JSON受信方式とは異なります。

このプロジェクトでは視聴用WebSocketの開始・ping/pong・seat維持、メッセージストリーム、セグメントストリーム、Protobuf解析、イベント分類、切断時の再接続をMITライセンスの `nicomget` 2.2.4へ委譲します。

## 接続フロー

1. アプリ専用ニコニコセッションで番組ページを確認
2. 番組ページの視聴用WebSocket URLがニコニコ配下の `wss:` であることを確認
3. `user_session` / `user_session_secure` Cookieをメインプロセス内だけで取得
4. `NiconicoProvider` に放送IDとCookieヘッダーを渡す
5. `comment` / `operatorComment` / `gift` / `emotion` / `notification` イベントを受信
6. raw ProtobufやCookieを除き、表示に必要なフィールドだけをRendererへ渡す
7. 接続が切れた場合はprovider側の上限付き自動再接続を利用

## 接続先の安全確認

- 視聴用WebSocketは `wss://*.nicovideo.jp` のみ許可
- NDGR HTTP接続は `https://mpn.live.nicovideo.jp` の指定パスのみ許可
- Cookieは許可された接続先以外へ送信しない
- IPCはメイン画面からの要求のみ許可
- RendererにはCookie値、WebSocket URL、view URI、生Protobufを渡さない

## コメント表示

- 一般コメント / 放送者コメント / ギフト / エモーション / 通知
- 過去コメントの目印と取得ON/OFF
- 本文・ユーザー名・IDの検索
- 種別フィルター
- 表示中コメントのコピー
- CSV書き出し
- 表示件数は最大1,000件

## 制約

- `nicomget` はMITライセンスの外部OSSで、プロトコル処理を担当します。
- NDGR・放送ページの一部は公開された安定APIではなく、仕様変更で動作しなくなる可能性があります。
- `connected` は視聴セッション確立を示し、配信主権限・コメント送信権限を意味しません。
- コメント送信、運営コメント送信、アンケート操作、番組作成、延長操作は本版では行いません。
- バックログを有効にすると接続直後に過去コメントも表示されます。

## テスト

`npm test` はコメントデータ整形、raw情報の除外、文字数上限、NDGR接続先allowlist、放送IDパーサーをローカルでテストします。実アカウントを使った統合テストは行っていません。
