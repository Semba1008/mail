# データベース(Supabase)

※ 実スキーマには直接アクセスしていないため、アプリケーションコード上の利用箇所およびPower Automateのアクション内容から復元した項目定義です。

## projects(案件情報)

| Column | Type | Description |
|--------|------|-------------|
| projects_id | text | PK。Power Automateがメールのメッセージ ID をそのまま採番して仮登録する |
| id | bigint | 画面表示・お気に入り等の識別に使う連番 |
| title | text | 案件名(メール件名) |
| category | text | カテゴリ判定元の文字列(開発/インフラ/組み込みのいずれかを含む) |
| location | text | 勤務地(地域絞り込みにも使用) |
| price | text | 単価(自由記述) |
| period | text | 期間(自由記述) |
| end_date | text | 募集期限 |
| content | text | メール本文 |
| skills | text | 必須スキル(検索対象) |
| cc_address | text | メール作成時のCcアドレス |
| isClosed | boolean | 募集終了フラグ |
| created_at | timestamp | 登録日時(統計グラフの年月集計に使用) |

## attachments(添付ファイル)

| Column | Type | Description |
|--------|------|-------------|
| id | bigint | PK |
| attachments_id | text | FK(projects.projects_id)。メールのメッセージIDが設定されるためprojects_idと同一値 |
| file_name | text | 添付ファイル名(Power AutomateがGUID+拡張子で生成) |
| file_url | text | Supabase Storage上のファイルURL |

## candidates(人材提案)

他社からの人材紹介メール(自社の募集案件ではなく、他社が紹介する人材の情報)を保存するテーブル。Power AutomateがAI抽出結果の`is_human_resource`をtrueと判定した場合にPOSTされ、同じ内容はprojectsには残さない(仮登録分は削除される)。

| Column | Type | Description |
|--------|------|-------------|
| title | text | メール件名 |
| content | text | メール本文 |
| location | text | 勤務地(AI抽出) |
| price | text | 単価(AI抽出) |
| skills | text | スキル(AI抽出) |
| period | text | 期間(AI抽出) |
| end_date | text | 募集期限(AI抽出) |
| category | text[] | 分類(開発/インフラ/組み込みのうち該当するもの、複数可) |
| isClosed | boolean | 常にfalse |
| is_human_resource | boolean | 常にtrue |

## admins(管理者)

| Column | Type | Description |
|--------|------|-------------|
| user_email | text | PK。ログインID |
| password_hash | text | PBKDF2によるハッシュ値。未設定なら初回ログイン扱い |
| salt | text | ハッシュ生成用ソルト |

## sessions(セッション)

| Column | Type | Description |
|--------|------|-------------|
| token | text | PK。UUID形式。Cookieの値と一致 |
| user_email | text | FK(admins.user_email) |

## results(automateの実行結果)

Power Automateの主要な操作(メール取込フロー)の成功・失敗を記録するテーブル。`automateの実行結果`画面([pages/automate-results.js](../pages/automate-results.js))から閲覧する。

| Column | Type | Description |
|--------|------|-------------|
| id | bigint | PK(連番) |
| created_at | timestamptz | 実行日時(既定値`now()`) |
| aisearch | boolean | AI分析(Groq API呼び出し)の成否。既定値`false` |
| input_candidated | boolean | 人材紹介テーブル(candidates)への登録処理の成否。既定値`false` |
| isclose | boolean | 募集停止テーブル(projectsのisClosed更新)への登録処理の成否。既定値`false` |
| input_projects | boolean | メイン情報を保持したテーブル(projects)への登録処理の成否。既定値`false` |
| allpass | boolean | すべての操作が成功した場合のみ`true`。この画面の成功/失敗判定に使用 |
| lastpass | boolean | 最後の操作まで到達したことを示すフラグ。既定値`false` |

⚠️ カラム名はSupabaseの管理画面上では`AiSearch`/`isClose`/`allPass`/`lastPass`のように表示されるが、実際にPostgREST(supabase-js)経由で取得すると**すべて小文字**(`aisearch`/`isclose`/`allpass`/`lastpass`)で返ってくる。アプリ側でキャメルケースのまま参照すると常に`undefined`(=失敗扱い)になるバグが発生したため、[components/AutomateResults.js](../components/AutomateResults.js)は小文字キーで参照している。

⚠️ このテーブルは`service_role`にSELECT権限が付与されていない状態で作成されており、`/api/automate-results`が`permission denied for table results`で500になる事象が発生した。`GRANT SELECT ON public.results TO service_role;`をSupabase側で実行して解消済み。同様の新規テーブル追加時は権限付与を忘れないよう注意。

## ブラウザ側(疑似テーブル・localStorage)

サーバーには保存されず、ブラウザごとに保持される。

| Key | 内容 |
|-----|------|
| favorites | お気に入り登録した案件idの一覧 |
| appliedIds | 応募済みにした案件idの一覧 |
| history | 閲覧した案件idの履歴(最大50件) |
| readProjects | 既読にした案件idの一覧 |
| searchHistory | 検索キーワードの履歴(最大20件) |
| autoExportEnabled | CSV自動書き出し機能の有効/無効フラグ(`true`/`false`) |
| autoExportLastMonth | CSV自動書き出し済みの年月(`YYYY-MM`形式)。同じ月に重複して書き出さないための判定に使用 |

## ブラウザ側(IndexedDB)

CSV自動書き出しの保存先フォルダハンドル(`FileSystemDirectoryHandle`)は構造化複製できるため、localStorageではなくIndexedDBに保存する。

| DB名 | ストア名 | Key | 内容 |
|---|---|---|---|
| mailapp-auto-export | handles | csvExportDir | 選択済みの保存先フォルダの`FileSystemDirectoryHandle`。「解除」操作でレコードごと削除される |
