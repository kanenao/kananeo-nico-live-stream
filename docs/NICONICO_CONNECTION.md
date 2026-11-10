# ニコニコ接続・認証

## 公式ログイン

- Electronの専用永続セッション `persist:kananeo-niconico` を使用
- ニコニコ公式Webサイトを別BrowserWindowで開く
- アプリ自身はメールアドレス・パスワードを受け取らず、入力フォームへ注入しない
- Cookieの値はRenderer / ログ / GitHubへ出力しない
- ログアウトはこのアプリ専用セッションだけを削除

## 番組ページ確認

- 放送IDと公式番組URLだけ受け付ける
- `embedded-data` を解析し、視聴用WebSocket URLの有無を確認
- ニコニコ配下の `wss:` 以外は拒否
- ページ仕様変更、認証要求、404 / 403、タイムアウトを区別する

## β4：コメント受信

- 現行NDGR方式を使い、視聴用WebSocketで視聴セッションを開始
- メッセージサーバー・セグメントのProtobuf HTTPストリームは `nicomget` に委譲
- NDGR HTTP URIは `https://mpn.live.nicovideo.jp` の指定パスだけを許可
- `user_session` / `user_session_secure` Cookieはメインプロセス内の接続処理だけで使用
- Rendererには表示用に正規化したコメント情報だけを渡す
- Cookie、WebSocket URL、view URI、raw ProtobufはRenderer・ログ・CSVに渡さない
- 切断時はライブラリの上限付き自動再接続を利用

## 制約

- `connected` は視聴セッション確立を意味し、配信主権限やコメント送信権限を示しません。
- コメント送信、運営コメント送信、番組作成、次枠、延長、アンケート操作は別途仕様・権限を確認してから実装します。
- ログイン後の実アカウント・実放送による統合テストはまだ行っていません。
- 詳細なNDGRフローは `docs/NDGR_COMMENTS.md` を参照してください。
