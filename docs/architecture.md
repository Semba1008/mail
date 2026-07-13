# システム構成

## 全体構成

```
Outlook(共有メールボックス sales_ses@ge-creative.co.jp)
        ↓ 新着メール検知(1分間隔ポーリング)
Power Automate(案件メール自動解析・DB連携フロー)
        ↓ JSON抽出リクエスト
Groq API(モデル: qwen/qwen3-32b)
        ↓ 抽出結果(JSON)
Supabase(Postgres + Storage)
        ↑ REST API(SELECT/INSERT/UPDATE/DELETE)
Next.js(GitHubで管理、Vercelへ自動デプロイ)
        ↓ HTTPS
管理者(ブラウザ)
```

## Outlook

共有メールボックス(sales_ses@ge-creative.co.jp)で案件配信メールを受信する。

## Power Automate

新着メールをトリガーに、本文をHTML→テキスト変換し、抽出・分類ルールを含むプロンプトを生成してGroq APIへ送信する。AI呼び出しが失敗した場合はScope Recoveryで1回再試行する。

抽出結果を受けて以下の分岐処理を行う。

- **is_human_resource = true(他社からの人材紹介メール)**: `candidates` テーブルへ登録し、`projects` の仮登録を削除
- **is_human_resource = false かつ isClosed = true(案件終了)**: `projects` のisClosedをPATCH更新(失敗時は削除)
- **is_human_resource = false かつ isClosed = false(通常案件)**: `projects` を詳細情報でPATCH更新(失敗時は削除)

添付ファイルがある場合は別処理(For eachループ)で取得し、Supabase StorageへPUTアップロードした上で`attachments`テーブルへ登録する。

最後に1分間のWaitを挟んで終了する。

## Groq API

モデル `qwen/qwen3-32b` を使用し、メール本文から案件情報をJSON形式で抽出する(Chat Completions形式、temperature=0、response_format=json_object)。抽出項目: `location` / `price` / `skills` / `period` / `isClosed` / `end_date` / `is_human_resource` / `category`。

## Supabase

Power Automateからのデータを `projects` テーブルで保持する。`projects_id` はメールのメッセージIDをそのまま採番する。

添付ファイル情報は `attachments` テーブルで `file_url` と `file_name` と `attachments_id`(= メールのメッセージID。`projects_id` と同一値。ハッシュ化ではない)を保持する。

他社からの人材紹介メールは `candidates` テーブルに保存され、`projects` には残らない。

認証情報は `admins`(管理者アカウント)・`sessions`(ログインセッション)テーブルで管理する。

Power Automateフローの主要な操作(AI分析/候補登録/募集停止登録/案件登録)の成否は `results` テーブルに記録され、`/automate-results` 画面で確認できる。

## Next.js / Vercel

ソースはGitHubで管理し、mainブランチへのマージを契機にVercelが自動デプロイする。管理者はブラウザからHTTPSでアクセスし、案件の検索・閲覧・応募管理・統計グラフ(`/stats`)・automateの実行結果確認(`/automate-results`)を利用する。

## 関連ドキュメント

- 詳細な項目定義: [database.md](database.md)
- 処理シーケンス: [sequence.md](sequence.md)
- どのファイルが何をしているか: [modules.md](modules.md)
- 既知の課題・未決事項: [known-issues.md](known-issues.md)
- 網羅的な仕様: [仕様書.docx](仕様書.docx) / [設計書.docx](設計書.docx)
