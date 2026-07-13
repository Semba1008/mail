# 既知の課題・未決事項

「どこを直せばよいか」の入口となる一覧。詳細な経緯・参照箇所は [仕様書.docx](仕様書.docx) 8章・9章を参照。

## 既知の課題

| 分類 | 課題 | 関連ファイル |
|---|---|---|
| コード品質 | `utils/project.js`の`getProjectCategories`と`utils/projectStats.js`の`getChartCategory`が似た役割(カテゴリ判定)を別々に持ち、未分類時のフォールバックが異なる(`"dev"` vs `"other"`)。意図した差か要確認 | [utils/project.js](../utils/project.js), [utils/projectStats.js](../utils/projectStats.js) |
| 性能・拡張性 | 案件検索が全件クライアント取得方式。件数増加(数万件規模)で表示速度が低下するおそれ | [pages/index.js](../pages/index.js) |
| セキュリティ | CSRFトークンによる二重防御、ログイン試行回数制限が無い | [pages/api/login.js](../pages/api/login.js) |
| セキュリティ | セッションの強制失効機能が無い(Cookie漏洩時に即時無効化できない) | [pages/api/logout.js](../pages/api/logout.js) |
| データ運用 | 「365日経過で非表示」は表示フィルタのみで、Supabase上のレコードは自動削除されず無期限に増加する | [pages/index.js](../pages/index.js) |
| データ運用 | 案件削除は物理削除で取消不可。誤操作時の復旧手段が無い | [pages/api/mails.js](../pages/api/mails.js) |
| 運用監視 | Power Automate(メール取込)の異常系は能動的な通知が無い。`/automate-results`画面で結果を確認できるようになったが、管理者が能動的に開いて確認する必要がある(プッシュ通知等は無い) | [pages/automate-results.js](../pages/automate-results.js) |
| 運用監視 | 添付ファイルのアップロード・登録失敗時のリカバリが無く、失敗した添付ファイルは取り込まれない | ― (Power Automate側) |
| 監査 | 案件削除・応募状況変更等の操作履歴(いつ・誰が)を記録する監査ログが無い | [pages/api/mails.js](../pages/api/mails.js) |
| データ整合性 | `candidates`テーブルへの登録内容とprojectsの項目定義が完全には一致しておらず、スキーマの正式な整理が望ましい | ― (Power Automate側) |
| 運用監視 | CSV自動書き出しはブラウザ(タブ)が開いている間のみ動作するクライアント完結の仕組みであり、サーバー側で定期実行される真のバッチ処理ではない。ブラウザを開かない限り実行されない | [utils/useAutoExportWatcher.js](../utils/useAutoExportWatcher.js) |

## 未決事項(要確認)

| No | 内容 |
|---|---|
| 1 | Groq APIの認証ヘッダの具体的な形式、APIキーの管理方法(接続情報化されているか) |
| 2 | Power AutomateのHTTPアクションのタイムアウト値・リトライポリシーの設定値 |
| 3 | `category`項目がSupabaseの`projects`テーブルに実際にどのような形式(文字列結合/配列)で保存されるか |
| 4 | AI抽出JSONスキーマ上の`attachments`プロパティが実際に使用されているか(未使用の残置項目である可能性) |
| 5 | `candidates`テーブルのSupabase側の正式なカラム定義(型・制約) |
| 6 | 添付ファイルアップロード失敗時に将来的にリカバリを実装する予定があるか |
| 7 | Power Automate側の失敗を能動的に通知する仕組み(メール/Teams等)を追加する予定があるか |
| 8 | 案件データの長期保持方針(アーカイブ・物理削除のタイミング)を策定する予定があるか |

## 関連ドキュメント

- モジュール構成マップ: [modules.md](modules.md)
- 網羅的な既知課題・未決事項・レビュー履歴: [仕様書.docx](仕様書.docx) 8章・9章・10章
