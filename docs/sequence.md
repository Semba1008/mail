# 主要シーケンス

## 案件情報取込(Power Automate)

```mermaid
sequenceDiagram
  participant O as Outlook共有メールボックス
  participant PA as Power Automate
  participant AI as Groq API(qwen3-32b)
  participant SB as Supabase(REST/Storage)

  O->>PA: 新着メール検知(1分間隔ポーリング)
  PA->>PA: 本文をHTML→テキスト変換
  PA->>PA: 抽出・分類ルールを含むプロンプト生成
  PA->>AI: JSON抽出リクエスト(Scope Normal)
  alt 成功
    AI-->>PA: location/price/skills/period/isClosed/end_date/is_human_resource/category
  else 失敗
    PA->>AI: 再試行(Scope Recovery)
    alt 再試行も失敗
      PA->>SB: DELETE projects(仮登録分)
    else 再試行成功
      AI-->>PA: 抽出結果
    end
  end
  PA->>SB: POST projects(仮登録)
  alt is_human_resource = true(人材紹介)
    PA->>SB: POST candidates
    PA->>SB: DELETE projects
  else isClosed = true(案件終了)
    PA->>SB: PATCH projects(isClosed=true)
    PA->>SB: (失敗時)DELETE projects
  else 通常案件
    PA->>SB: PATCH projects(詳細情報)
    PA->>SB: (失敗時)DELETE projects
  end
  loop 添付ファイルごと
    PA->>O: 添付ファイル取得(V2)
    PA->>PA: ファイル名生成(GUID+拡張子)
    PA->>SB: PUT(Storageへアップロード)
    PA->>SB: GET projects(該当案件検索)
    PA->>SB: POST attachments(attachments_id=メールID)
  end
  PA->>PA: 1分間 Wait
```

## 案件一覧取得

```mermaid
sequenceDiagram
  participant U as ブラウザ
  participant P as Next.jsページ(/)
  participant A as API(/api/mails)
  participant DB as Supabase(projects/attachments)

  U->>P: ページアクセス
  P->>A: GET /api/me(セッション確認)
  A-->>P: 認証OK(未ログインなら/loginへリダイレクト)
  P->>A: GET /api/mails?page=n(page=0,1,2...)
  A->>DB: SELECT projects + attachments
  DB-->>A: 案件データ
  A-->>P: JSON応答(1,000件単位)
  P-->>U: 一覧表示(検索・絞込・ページング)
```

## ログイン

```mermaid
sequenceDiagram
  participant U as 管理者(ブラウザ)
  participant N as Next.js API(/api/login)
  participant DB as Supabase(admins/sessions)

  U->>N: POST /api/login (email, password)
  N->>DB: SELECT admins WHERE user_email
  DB-->>N: password_hash, salt
  N->>N: PBKDF2でハッシュ照合
  alt 一致
    N->>DB: INSERT sessions (token, user_email)
    N-->>U: Set-Cookie: token / 200 OK
  else 不一致
    N-->>U: 401 Error
  end
```

## 案件削除

```mermaid
sequenceDiagram
  participant U as 管理者
  participant A as API(/api/mails DELETE)
  participant DB as Supabase(DB)
  participant ST as Supabase Storage

  U->>A: DELETE /api/mails?id=xxx
  A->>DB: SELECT attachments WHERE attachments_id
  DB-->>A: file_url一覧
  A->>ST: 添付ファイルを削除
  A->>DB: DELETE attachments
  A->>DB: DELETE projects
  A-->>U: 200 OK
```

## ログアウト

```mermaid
sequenceDiagram
  participant U as 管理者(ブラウザ)
  participant N as Next.js API(/api/logout)
  participant DB as Supabase(sessions)

  U->>N: POST /api/logout
  N->>DB: DELETE sessions WHERE token
  N-->>U: Set-Cookie: token=; Max-Age=0 / 200 OK
```

## セッション確認(/api/me)

```mermaid
sequenceDiagram
  participant U as 管理者(ブラウザ)
  participant N as Next.js API(/api/me)
  participant DB as Supabase(sessions/admins)

  U->>N: GET /api/me
  N->>DB: SELECT sessions WHERE token
  DB-->>N: user_email
  N->>DB: SELECT admins.password_hash WHERE user_email
  DB-->>N: password_hash
  N-->>U: { email, firstLogin }
```

## パスワード設定・リセット

```mermaid
sequenceDiagram
  participant U as 管理者(ブラウザ)
  participant N as Next.js API(setup-password / reset-password)
  participant DB as Supabase(admins)

  U->>N: POST { email, password }
  N->>DB: SELECT admins WHERE user_email
  DB-->>N: password_hash, salt(設定済みかどうか)
  N->>N: 新しいsalt生成 + PBKDF2でハッシュ化
  N->>DB: UPDATE admins SET password_hash, salt
  N-->>U: { success: true }
```

## 統計グラフ書き出し(CSV例)

```mermaid
sequenceDiagram
  participant U as 管理者
  participant S as /statsページ
  participant FS as ブラウザ(File System Access API)

  U->>S: 地域/年/月を選択しCSVで書き出しをクリック
  S->>S: 該当案件を抽出しCSVデータ生成
  S->>FS: showSaveFilePicker()
  FS-->>U: 保存先選択ダイアログ表示
  U->>FS: 保存先を決定
  FS-->>S: 書き込み完了
```

## CSV自動書き出し(月次・任意機能)

```mermaid
sequenceDiagram
  participant U as 管理者
  participant H as useAutoExportWatcher
  participant AU as autoExport.js(IndexedDB/localStorage)
  participant FS as ブラウザ(File System Access API)
  participant N as Notification API

  U->>H: ページ表示(マウント時 / 以後30分間隔)
  H->>AU: getAutoExportEnabled()
  alt 有効
    H->>AU: loadDirectoryHandle()
    AU-->>H: FileSystemDirectoryHandle
    H->>AU: getLastExportedMonth() / 前月キー算出
    alt 前月分が未書き出し
      H->>FS: queryDirectoryPermission(handle)
      alt 権限あり
        H->>H: filterProjectsByPeriod + buildProjectsCsvBlob
        H->>FS: getFileHandle→createWritable→write→close
        H->>AU: setLastExportedMonth(前月キー)
        H->>N: 通知("前月分をCSVで自動保存しました")
      else 権限失効
        H-->>U: "フォルダを再許可"ボタンを表示(要再許可)
      end
    else 書き出し済み
      H-->>H: 何もしない(重複書き出し防止)
    end
  else 無効
    H-->>H: 何もしない
  end
```

## 関連ドキュメント

- 図解付きの詳細: [設計書.docx](設計書.docx) 3章「詳細設計」
- Power Automateの分岐条件・異常系: [仕様書.docx](仕様書.docx) 1.4.1, 1.8, 5章
