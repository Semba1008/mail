// 案件データ関連の共通ユーティリティ
// サイドバーの絞り込み(カテゴリチェックボックス)で使用中のため、挙動を変える際は要注意
// (グラフ集計専用の判定ロジックは utils/projectStats.js の getChartCategory に別途存在する)

// 案件のカテゴリ判定
// 1件の案件が複数カテゴリに該当する場合があるため配列で返す(絞り込みは複数選択のOR条件のため)
export const getProjectCategories = (project) => {
  const text = `${project.category}`.toLowerCase();
  const categories = [];
  if (/業務系/i.test(text)) categories.push("dev");
  if (/インフラ/i.test(text)) categories.push("infra");
  if (/組み込み/i.test(text)) categories.push("embedded");
  return categories.length ? categories : ["other"];
};
