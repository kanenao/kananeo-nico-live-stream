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

## β8：番組統計（読み取り専用）

- 統計取得：GET https://live2.nicovideo.jp/watch/{lv}/statistics
- data.watchCount / data.commentCount を検証して表示
- 番組タイトル・status・endTime は watch page の embedded-data から取り出す
- 統計はダッシュボードを開いている間、約30秒ごとに更新可能
- 更新APIは読み取り専用で、配信設定・コメント・番組状態を変更しません
- APIの元資料は2024年更新のコミュニティクライアントであり、実配信での継続動作は未検証

## β10：延長方法の確認（読み取り専用）

- 延長方法一覧：GET https://live2.nicovideo.jp/watch/{lv}/extension
- data.methods[] から type と minutes を読み取り、配信管理画面に表示
- 取得処理は読み取り専用で、枠の延長は実行しない
- 実際の延長は同じパスへのPOST minutesで実行する実装例があるが、延長種別・料金条件・現行API継続性を検証するまでは組み込まない
- 参照元は2024年更新のコミュニティ実装であり、公式仕様書ではない。実配信での統合試験が必要

## β7：自動アンケート

- アンケート開始：`POST https://live2.nicovideo.jp/unama/watch/{lv}/enquete`。JSONの `question` と `items` を送信
- 結果取得：`POST https://live2.nicovideo.jp/unama/watch/{lv}/enquete/result`
- アンケート終了：`DELETE https://live2.nicovideo.jp/unama/watch/{lv}/enquete`
- リクエストはElectronの専用セッションから送信し、Cookie値をRendererに渡さない
- 401 / 403 / 404 / 409 / timeout をアプリ側で区別して表示
- 配信主権限がない場合はAPI側の拒否を表示し、権限を偽装しない
- 実装根拠にした公開クライアントは2024年更新のコミュニティ実装であり、ニコニコ公式仕様書ではない。APIの継続動作は実アカウント試験が必要

## 制約

- `connected` は視聴セッション確立を意味し、配信主権限やコメント送信権限を示しません。
- コメント送信、運営コメント送信、番組作成、次枠、延長、アンケート操作は別途仕様・権限を確認してから実装します。
- ログイン後の実アカウント・実放送による統合テストはまだ行っていません。
- 詳細なNDGRフローは `docs/NDGR_COMMENTS.md` を参照してください。
