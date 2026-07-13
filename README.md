# mail-app

案件配信メールをSupabaseに取り込み、管理者が一覧・検索・応募管理・統計グラフを確認できるNext.js製の管理画面です。

## 主な機能

- **案件一覧・検索**
  - キーワード・駅名検索、地域/都道府県/スキルでの絞り込み
  - 募集停止案件の非表示、リモート案件のみ表示
  - お気に入り・応募済み・閲覧履歴の管理(localStorage)
  - 添付ファイルのダウンロード、案件の削除(添付ファイルも含めてSupabase Storageから削除)
- **ページネーション**
  - 案件一覧の上下にページ送りコントロールを表示([components/Pagination.js](components/Pagination.js))
- **統計グラフ(`/stats`)**
  - カテゴリ別の月別内訳(円グラフ)・年間推移(棒グラフ)
  - 地域・年・月による絞り込み
  - PDF/Excel(グラフ集計)、CSV(Supabase `projects` テーブルの案件明細)への書き出し
  - 対応ブラウザ(Chrome/Edge等)では書き出し時に保存先を選択可能(File System Access API)
  - CSV自動書き出し(任意機能): 保存先フォルダをあらかじめ設定しておくと、月が変わった際に前月分の案件データを自動でCSV保存し、成功を通知(ブラウザを開いている間のみ動作)
- **automateの実行結果(`/automate-results`)**
  - Power Automateフローの主要な操作(AI分析/人材紹介登録/募集停止登録/案件情報登録)の成功・失敗をSupabaseの`results`テーブルから一覧表示
  - 日付・月による絞り込み検索、すべて/成功のみ/失敗のみフィルタ
  - 全件数・成功数・失敗数のカード表示
  - 月別/日別の成功・失敗を左右に並べた棒グラフ(バー内に「成功」「失敗」の文字を表示)
  - 失敗行は、どの操作(AI分析/候補登録/募集停止登録/案件登録)でNGだったかを文字で表示
  - 一覧は1ページ50件。「結果」列見出し右端の◁▷ボタンでページ送り
- **認証**
  - メールアドレス+パスワードによるログイン、初回パスワード設定・パスワードリセット
  - Cookieセッション+管理者判定(Supabaseの`sessions`/`admins`テーブル)

## 技術構成

- [Next.js](https://nextjs.org/)(Pages Router)
- [Supabase](https://supabase.com/)(Postgres, Auth用テーブル, Storage)
- [Recharts](https://recharts.org/)(グラフ描画)
- [jsPDF](https://github.com/parallax/jsPDF) / [ExcelJS](https://github.com/exceljs/exceljs) / [html2canvas](https://html2canvas.hertzen.com/)(PDF/Excel書き出し)
- Microsoft Power Automate(本アプリ外の仕組み。受信した案件配信メールを解析し、`projects`/`attachments`テーブルへ登録してSupabaseに取り込むまでの処理を担当)

## メール取り込みの流れ(Power Automate)

案件配信メールがSupabaseの`projects`/`attachments`/`candidates`テーブルに登録されるまでの処理は、本リポジトリ外のMicrosoft Power Automateフロー(共有メールボックス `sales_ses@ge-creative.co.jp` を1分間隔で監視)で行われています。

1. **トリガー**: 共有メールボックスに新着メールが届いたとき
2. **本文の変換**: メール本文をHTML→テキスト形式に変換
3. **AI分析による情報抽出**: Groq API(モデル `qwen/qwen3-32b`)を用いて、本文から以下の項目をJSON形式で抽出
   - 勤務地(location) / 単価(price) / 必須スキル(skills) / 期間(period)
   - 募集終了フラグ(isClosed) / 募集期限(end_date)
   - 人材紹介判定(is_human_resource) / カテゴリ(category)
4. **Supabaseへの登録**: 人材紹介メールと判定された場合は`candidates`へ、それ以外は`projects`(必要に応じて`attachments`)へ登録・更新する

詳細な分岐条件・プロンプト全文は [仕様書.docx](docs/仕様書.docx) 1.4.1章・5章を参照してください。

### セットアップ時に必要なもの

- 共有メールボックスへのアクセス権(Power Automate接続用)
- Groq APIのAPIキー
- SupabaseのREST APIエンドポイントとAPIキー(HTTPコネクタのPOST先として設定)

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

プロジェクトルートに `.env` を作成し、以下を設定してください。

```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
```

- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`: クライアント側のSupabaseアクセスに使用([lib/supabase.js](lib/supabase.js))
- `SUPABASE_SERVICE_ROLE_KEY`: サーバー側API(`pages/api/*`)からのSupabaseアクセスに使用([lib/supabaseAdmin.js](lib/supabaseAdmin.js))

Supabase側には以下のテーブルが必要です。

- `projects` / `attachments`: 案件データと添付ファイル情報
- `candidates`: 他社からの人材紹介メールの情報(詳細は[database.md](database.md)参照)
- `sessions`: ログインセッション管理
- `admins`: 管理者ユーザーの一覧
- `results`: Power Automateフローの実行結果(詳細は[database.md](database.md)参照。`service_role`へのSELECT権限付与が必要)

### 3. 開発サーバーの起動

```bash
npm run dev
```

`http://localhost:3000` にアクセスします(ポートが使用中の場合は自動的に別ポートが割り当てられます)。

## スクリプト

| コマンド | 説明 |
|---|---|
| `npm run dev` | 開発サーバーを起動 |
| `npm run build` | 本番ビルドを作成 |
| `npm run start` | 本番ビルドを起動 |

## ディレクトリ構成

```
components/    UIコンポーネント(案件カード、統計グラフ、ページネーション等)
constants/     設定値(地域区分、スキル一覧、タブ定義など)
lib/           Supabaseクライアント初期化、認証補助
pages/         Next.jsページ(一覧、ログイン、統計グラフ等)
pages/api/     APIルート(ログイン/ログアウト/案件取得など)
public/        静的アセット
styles/        共通スタイル定義
utils/         フォーマット・集計・保存処理などのユーティリティ
```

## 主要ページ

| パス | 内容 |
|---|---|
| `/` | 案件一覧・検索・応募管理 |
| `/stats` | 案件情報グラフ(地域/年/月絞り込み、PDF/Excel/CSV書き出し) |
| `/automate-results` | automateの実行結果(日付/月検索、成功・失敗件数、月別/日別グラフ) |
| `/login` | ログイン |
| `/setup-password` | 初回パスワード設定 |
| `/reset-password` | パスワードリセット |

## ドキュメント

| ファイル | 内容 |
|---|---|
| [docs/architecture.md](docs/architecture.md) | システム全体構成(Outlook〜Vercel) |
| [docs/sequence.md](docs/sequence.md) | 主要処理のシーケンス図(Mermaid) |
| [docs/database.md](docs/database.md) | Supabaseのテーブル項目定義 |
| [docs/api.md](docs/api.md) | APIエンドポイント仕様(処理フロー・権限・依存テーブル) |
| [docs/modules.md](docs/modules.md) | どのファイルが何をしているか(修正箇所の特定用) |
| [docs/known-issues.md](docs/known-issues.md) | 既知の課題・未決事項 |
| [docs/仕様書.docx](docs/仕様書.docx) / [docs/設計書.docx](docs/設計書.docx) | 網羅的な仕様書・設計書 |
