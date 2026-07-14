// 案件のカテゴリ判定
export const getProjectCategories = (project) => {
  const text = `${project.category}`.toLowerCase();
  const categories = [];
  if (/開発/i.test(text)) categories.push("dev");
  if (/インフラ/i.test(text)) categories.push("infra");
  if (/組み込み/i.test(text)) categories.push("embedded");
  return categories.length ? categories : ["other"];
};
