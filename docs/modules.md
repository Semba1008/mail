# モジュール構成マップ

「どこを直せばよいか」を素早く特定するための、ファイル単位の責務一覧。図解版は [設計書.docx](設計書.docx) 3.1章「クラス図(モジュール構成図)」を参照。

## pages/(画面)

| ファイル | 責務 |
|---|---|
| [pages/index.js](../pages/index.js) | 案件一覧画面。認証チェック、案件取得(`fetchData`)、検索・絞込(`filteredProjects`)、お気に入り/応募済み/削除の操作、ページネーション2箇所の表示を担う本体。`useAutoExportWatcher`を呼び出し、CSV自動書き出しの成功通知バナーを表示 |
| [pages/stats.js](../pages/stats.js) | 統計グラフ画面のデータ取得(認証チェック+`/api/mails`呼び出し)。表示自体は`ProjectStats`に委譲 |
| [pages/automate-results.js](../pages/automate-results.js) | automateの実行結果画面のデータ取得(認証チェック+`/api/automate-results`呼び出し)。表示自体は`AutomateResults`に委譲(rechartsを使うため`dynamic`+`ssr:false`) |
| [pages/login.js](../pages/login.js) | ログインフォーム。`/api/login`呼び出し |
| [pages/setup-password.js](../pages/setup-password.js) | 初回パスワード設定フォーム |
| [pages/reset-password.js](../pages/reset-password.js) | パスワードリセットフォーム |

## pages/api/(APIルート)

詳細は [api.md](api.md) を参照。

| ファイル | 責務 |
|---|---|
| [pages/api/mails.js](../pages/api/mails.js) | 案件一覧取得(GET)・削除(DELETE)。認証チェックも兼ねる |
| [pages/api/login.js](../pages/api/login.js) | ログイン認証・セッション発行 |
| [pages/api/logout.js](../pages/api/logout.js) | セッション破棄 |
| [pages/api/me.js](../pages/api/me.js) | セッション確認・初回ログイン判定 |
| [pages/api/setup-password.js](../pages/api/setup-password.js) | 初回パスワード設定 |
| [pages/api/reset-password.js](../pages/api/reset-password.js) | パスワードリセット |
| [pages/api/automate-results.js](../pages/api/automate-results.js) | automateの実行結果一覧取得(GET)。認証チェックも兼ねる |

## components/(UIコンポーネント)

| ファイル | 責務 |
|---|---|
| [components/ProjectCard.js](../components/ProjectCard.js) | 案件一覧の1カード分の表示(場所/単価/期間/募集人数、お気に入り・応募済み・削除ボタン) |
| [components/ContentDisplay.js](../components/ContentDisplay.js) | 案件本文の表示。Base64エンコードされた本文のデコード、HTML本文のサニタイズ表示(DOMPurify)、プレーンテキスト表示の切替を行う |
| [components/Pagination.js](../components/Pagination.js) | ページ送りUI(案件一覧の上下2箇所で共有) |
| [components/ProjectStats.js](../components/ProjectStats.js) | 統計グラフ画面の本体。地域/年/月の絞込、円グラフ・棒グラフ切替、PDF/Excel/CSV書き出し、CSV自動書き出しの設定UI(保存先フォルダ選択・解除、有効/無効切替、再許可) |
| [components/AutomateResults.js](../components/AutomateResults.js) | automateの実行結果画面の本体。日付/月での絞込検索、すべて/成功のみ/失敗のみフィルタ、全件数・成功数・失敗数のカード表示、月別/日別の成功・失敗積み上げ棒グラフ(recharts)、一覧テーブル(ID/日時/結果。失敗時は`allPass`がfalseの行に対し、AiSearch/input_candidated/isClose/input_projects/lastPassのうちfalseの項目名を文字で表示) |

## lib/(外部サービス接続)

| ファイル | 責務 |
|---|---|
| [lib/supabase.js](../lib/supabase.js) | クライアント側Supabaseクライアント(匿名キー) |
| [lib/supabaseAdmin.js](../lib/supabaseAdmin.js) | サーバー側Supabaseクライアント(サービスロールキー)。全API Routesが使用 |
| [lib/auth.js](../lib/auth.js) | Cookieのtokenから`sessions`を引いてユーザーを特定するヘルパー |

## utils/(ロジック)

| ファイル | 責務 |
|---|---|
| [utils/format.js](../utils/format.js) | 都道府県名の正規化(`normalize`)、URL/メールのリンク化(`formatContent`)、募集人数抽出(`extractRecruitment`) |
| [utils/project.js](../utils/project.js) | サイドバーのカテゴリ絞込用の判定(`getProjectCategories`)。**該当なしの場合のフォールバックが`["dev"]`** |
| [utils/projectStats.js](../utils/projectStats.js) | 統計グラフ用の集計ロジック(`getChartCategory`、地域絞込、年月集計)、CSV生成(`buildProjectsCsvBlob`)。**該当なしの場合のフォールバックが`"other"`** |
| [utils/saveFile.js](../utils/saveFile.js) | File System Access API対応の保存処理(非対応時は自動ダウンロードにフォールバック) |
| [utils/storage.js](../utils/storage.js) | localStorageの読み書きラッパー(favorites/history/readProjects/appliedIds) |
| [utils/autoExport.js](../utils/autoExport.js) | CSV自動書き出し用の保存先フォルダ管理。IndexedDB(`mailapp-auto-export`)への`FileSystemDirectoryHandle`保存/読込/解除(`saveDirectoryHandle`/`loadDirectoryHandle`/`clearDirectoryHandle`)、権限確認・再許可(`queryDirectoryPermission`/`requestDirectoryPermission`)、有効フラグ・書き出し済み月のlocalStorage管理 |
| [utils/useAutoExportWatcher.js](../utils/useAutoExportWatcher.js) | CSV自動書き出しの判定・実行を行う共有Reactフック。`pages/index.js`と`components/ProjectStats.js`の両方から呼び出され、マウント時+30分間隔で「前月分が未書き出しか」を判定し、条件が揃えば自動でCSVを書き出して結果(成功/要再許可/失敗)を`onResult`で通知 |

⚠️ `utils/project.js`と`utils/projectStats.js`は似た役割(カテゴリ判定)を別々に持っており、**未分類時のフォールバック値が異なる**(前者は"dev"、後者は"other")。挙動の差はサイドバー絞込と統計グラフの間で意図したものか要確認([known-issues.md](known-issues.md)にも記載)。

## constants/(定数)

| ファイル | 内容 |
|---|---|
| [constants/config.js](../constants/config.js) | `PAGE_SIZE`(1ページの表示件数) |
| [constants/regions.js](../constants/regions.js) | 地域区分(東日本/中日本/西日本)と対応都道府県 |
| [constants/skills.js](../constants/skills.js) | スキル絞込の選択肢一覧 |
| [constants/tabs.js](../constants/tabs.js) | 案件一覧のタブ(探す/応募済み/お気に入り/履歴)とサイドバーカテゴリの定義 |

## 関連ドキュメント

- 処理の流れ: [sequence.md](sequence.md)
- テーブル定義: [database.md](database.md)
- 既知の課題: [known-issues.md](known-issues.md)
