# API一覧

すべて `pages/api/` 配下のNext.js API Routes。認証系(`/api/mails`)は `token` Cookie(セッション)必須で、`sessions`→`admins`の順に照合し、いずれも無効な場合はエラーを返す。

## GET /api/mails

案件情報を1,000件単位でページングしながら取得する。全件取得するには `page` を0からインクリメントしながら、`data.length < 1000` になるまで呼び出す。

**処理フロー**
1. Cookieの `token` を取得(無ければ401)
2. `sessions` を `token` で検索(無ければ401)
3. `sessions.user_email` が `admins` に存在するか確認(無ければ403)
4. `page` ・ `pageSize(1000)` からrange指定し、`projects` を `attachments` 込みで `created_at` 降順取得
5. `{ data }` を返却

**シーケンス図**: [sequence.md #案件一覧取得](sequence.md#案件一覧取得)

**権限**: 管理者(有効なセッション + adminsに登録済み)

**依存テーブル**: `sessions`, `admins`, `projects`, `attachments`

### Request

```
GET /api/mails?page=0
Cookie: token=<セッショントークン>
```

| Query | 型 | 必須 | 説明 |
|---|---|---|---|
| page | number | 任意(既定0) | 0始まりのページ番号。1ページ1,000件 |

### Response(200)

```json
{
  "data": [
    {
      "projects_id": "AAMkAGI2...",
      "id": 123,
      "title": "【急募】ECサイトリニューアル開発エンジニア",
      "category": "開発",
      "location": "東京都渋谷区(渋谷駅)",
      "price": "60万円〜75万円",
      "period": "6ヶ月〜",
      "end_date": "2026-08-15",
      "content": "...",
      "skills": "React,Node.js",
      "cc_address": "sales@example.com",
      "isClosed": false,
      "created_at": "2026-07-01T00:00:00.000Z",
      "attachments": [
        { "id": 1, "file_name": "spec.pdf", "file_url": "https://.../FILES/xxxx.pdf" }
      ]
    }
  ]
}
```

### Response(エラー)

| Status | Body | 条件 |
|---|---|---|
| 401 | `{ "error": "未ログイン" }` | tokenが無い |
| 401 | `{ "error": "無効なセッション" }` | sessionsに該当tokenが無い |
| 403 | `{ "error": "権限なし" }` | セッションのuser_emailがadminsに無い |
| 500 | `{ "error": "<Supabaseのエラーメッセージ>" }` | Supabase側のエラー |

## DELETE /api/mails

案件と紐づく添付ファイル(Storage実体・attachmentsレコード)、projectsレコードを物理削除する。取消不可。

**処理フロー**
1. 認証チェック(GETと同様、token→sessions→admins)
2. `id`(=`projects_id`)の妥当性チェック
3. `attachments` から `attachments_id = id` を検索し `file_url` を取得
4. `file_url` からファイルパスを抽出し、Storage(`FILES`バケット)から実体を削除
5. `attachments` → `projects` の順にレコードを削除

**シーケンス図**: [sequence.md #案件削除](sequence.md#案件削除)

**権限**: 管理者(有効なセッション + adminsに登録済み)

**依存テーブル**: `sessions`, `admins`, `attachments`, `projects` / Supabase Storage(`FILES`バケット)

### Request

```
DELETE /api/mails?id=<projects_id>
Cookie: token=<セッショントークン>
```

| Query | 型 | 必須 | 説明 |
|---|---|---|---|
| id | string | 必須 | 削除対象の `projects_id`(= 添付ファイル側の `attachments_id` と同一値) |

### Response(200)

```json
{ "message": "削除成功" }
```

### Response(エラー)

| Status | Body | 条件 |
|---|---|---|
| 400 | `{ "error": "IDが無効です" }` | idが未指定 |
| 401 / 403 | 認証エラー(GETと同様) | 未ログイン・無効セッション・権限なし |

## POST /api/login

メールアドレス・パスワードで認証し、セッションを発行する。

**処理フロー**
1. `admins` を `user_email` で検索(無ければ401 NOT_ADMIN)
2. `password_hash`/`salt` が未設定なら401 NO_PASSWORD(初回ログイン)
3. 入力パスワードを同じsaltでPBKDF2ハッシュ化し、`timingSafeEqual`で比較(不一致なら401 INVALID_PASSWORD)
4. 既存Cookieのtokenがあれば `sessions` から削除
5. 新規UUIDトークンを発行し `sessions` へINSERT
6. `Set-Cookie`(HttpOnly, 7日間)を返却

**シーケンス図**: [sequence.md #ログイン](sequence.md#ログイン)

**権限**: 認証前(誰でも呼び出し可能。ただし`admins`登録済みメールアドレスでなければ成功しない)

**依存テーブル**: `admins`, `sessions`

### Request

```json
{
  "email": "admin@example.com",
  "password": "P@ssw0rd123"
}
```

### Response(200)

```json
{ "status": "success", "email": "admin@example.com" }
```

成功時は `Set-Cookie: token=<UUID>; HttpOnly; SameSite=Lax; Secure(本番のみ); Max-Age=604800`(7日間)を返す。

### Response(エラー、いずれも401)

| error | 条件 |
|---|---|
| NOT_ADMIN | adminsに該当メールアドレスが無い |
| NO_PASSWORD | password_hash/saltが未設定(初回ログイン未実施) |
| INVALID_PASSWORD | パスワード不一致 |

## POST /api/logout

現在のセッションを破棄する。

**処理フロー**
1. Cookieの `token` を取得(無くてもエラーにしない)
2. tokenがあれば `sessions` から該当レコードを削除
3. Cookieを `Max-Age=0` で上書き

**シーケンス図**: [sequence.md #ログアウト](sequence.md#ログアウト)

**権限**: 制限なし(ログイン状態でなくても200を返す)

**依存テーブル**: `sessions`

### Request

```
POST /api/logout
Cookie: token=<セッショントークン>
```

### Response(200)

```json
{ "success": true }
```

Cookieを `Max-Age=0` で上書きし、`sessions` から該当tokenを削除する。tokenが無くても200を返す。

## GET /api/me

セッションの有効性と初回ログイン要否を確認する。

**処理フロー**
1. Cookieの `token` を取得(無ければ401 NO_SESSION)
2. `sessions` を `token` で検索(無ければ401 INVALID_SESSION)
3. `sessions.user_email` を使って `admins.password_hash` を取得
4. `{ email, firstLogin }` を返却(`firstLogin` = `!password_hash`)

**シーケンス図**: [sequence.md #セッション確認apime](sequence.md#セッション確認apime)

**権限**: tokenを保持していれば呼び出し可能(admins登録の有無は問わない)

**依存テーブル**: `sessions`, `admins`

### Request

```
GET /api/me
Cookie: token=<セッショントークン>
```

### Response(200)

```json
{ "email": "admin@example.com", "firstLogin": false }
```

`firstLogin` は `admins.password_hash` が未設定の場合に `true`。

### Response(エラー、いずれも401)

| error | 条件 |
|---|---|
| NO_SESSION | tokenが無い |
| INVALID_SESSION | sessionsに該当tokenが無い |

## POST /api/setup-password

初回ログイン時のパスワード設定(未設定の管理者のみ)。

**処理フロー**
1. 入力チェック(email/password未指定なら400)
2. `admins` を `user_email` で検索(無ければ404)
3. `password_hash`/`salt` が既に設定済みなら403
4. パスワード強度チェック(NGなら400)
5. 新しいsaltを生成し、PBKDF2でハッシュ化して `admins` をUPDATE

**シーケンス図**: [sequence.md #パスワード設定・リセット](sequence.md#パスワード設定リセット)

**権限**: 初回ログイン前の管理者(`admins`に登録済みで、かつパスワード未設定であること)

**依存テーブル**: `admins`

### Request

```json
{ "email": "admin@example.com", "password": "P@ssw0rd123" }
```

パスワード要件: 英大文字・英小文字・数字を含む8文字以上(`/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d]{8,}$/`)。

### Response(200)

```json
{ "success": true }
```

### Response(エラー)

| Status | error | 条件 |
|---|---|---|
| 400 | メールアドレスとパスワードが必要です | 未入力 |
| 400 | パスワード要件を満たしていません | 強度チェックNG |
| 404 | ユーザーが見つかりません | adminsに無い |
| 403 | 既に設定済みです | password_hash/saltが既に設定済み |

## POST /api/reset-password

パスワードの再設定(既存メールアドレスに対して無条件で上書き)。

**処理フロー**
1. `admins` を `user_email` で検索(無ければ404)
2. 新しいsaltを生成し、PBKDF2でハッシュ化して `admins` をUPDATE

**シーケンス図**: [sequence.md #パスワード設定・リセット](sequence.md#パスワード設定リセット)

**権限**: 制限なし(メールアドレスが分かれば本人確認なしに再設定できる点に注意。2.12 セキュリティ運用も参照)

**依存テーブル**: `admins`

### Request

```json
{ "email": "admin@example.com", "password": "NewP@ssw0rd123" }
```

### Response(200)

```json
{ "success": true }
```

### Response(エラー)

| Status | error | 条件 |
|---|---|---|
| 404 | 管理者が見つかりません | adminsに該当メールアドレスが無い |
| 500 | 更新に失敗しました | Supabase更新エラー |

## GET /api/automate-results

Power Automateの実行結果(`results`テーブル)を取得する。

**処理フロー**
1. Cookieの `token` を取得(無ければ401)
2. `sessions` を `token` で検索(無ければ401)
3. `sessions.user_email` が `admins` に存在するか確認(無ければ403)
4. `page` ・ `pageSize(1000)` からrange指定し、`results` を `created_at` 降順取得
5. `{ data }` を返却

**権限**: 管理者(有効なセッション + adminsに登録済み)

**依存テーブル**: `sessions`, `admins`, `results`

### Request

```
GET /api/automate-results?page=0
Cookie: token=<セッショントークン>
```

| Query | 型 | 必須 | 説明 |
|---|---|---|---|
| page | number | 任意(既定0) | 0始まりのページ番号。1ページ1,000件 |

### Response(200)

```json
{
  "data": [
    {
      "id": 84,
      "created_at": "2026-07-10T09:03:11.000Z",
      "aisearch": true,
      "input_candidated": false,
      "isclose": true,
      "input_projects": true,
      "allpass": true,
      "lastpass": true
    }
  ]
}
```

⚠️ 列名はSupabaseの管理画面上は`AiSearch`等キャメルケースで表示されるが、PostgREST経由のレスポンスは実際には**すべて小文字**になる(詳細は[database.md](database.md)参照)。

### Response(エラー)

| Status | Body | 条件 |
|---|---|---|
| 401 | `{ "error": "未ログイン" }` | tokenが無い |
| 401 | `{ "error": "無効なセッション" }` | sessionsに該当tokenが無い |
| 403 | `{ "error": "権限なし" }` | セッションのuser_emailがadminsに無い |
| 500 | `{ "error": "<Supabaseのエラーメッセージ>" }` | Supabase側のエラー(例: `results`への権限不足) |

## 関連ドキュメント

- 認証フローの詳細: [sequence.md](sequence.md)
- テーブル定義: [database.md](database.md)
- 網羅的な仕様(メッセージ定義・異常系含む): [仕様書.docx](仕様書.docx) 2.7章・2.10章・2.11.2章
