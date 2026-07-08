// グラフ集計専用のカテゴリ判定・集計ロジック
// 既存の utils/project.js の getProjectCategories はサイドバー絞り込みで使用中のため、
// 挙動を変えないようこちらは独立した関数として定義する（未分類は "その他" 扱い）。
export const getChartCategory = (project) => {
  const text = `${project.category}`.toLowerCase();
  if (/開発/i.test(text)) return "dev";
  if (/インフラ/i.test(text)) return "infra";
  if (/組み込み/i.test(text)) return "embedded";
  return "other";
};

export const CHART_CATEGORY_ORDER = ["dev", "infra", "embedded", "other"];

export const CHART_CATEGORY_LABELS = {
  dev: "開発",
  infra: "インフラ",
  embedded: "組み込み",
  other: "その他",
};

export const CHART_CATEGORY_COLORS = {
  dev: "#3182ce",
  infra: "#38a169",
  embedded: "#dd6b20",
  other: "#a0aec0",
};

// データ内に存在する年の一覧（降順）
export const getAvailableYears = (projects) => {
  const years = new Set();
  projects.forEach((project) => {
    if (!project.created_at) return;
    const year = new Date(project.created_at).getFullYear();
    if (!Number.isNaN(year)) years.add(year);
  });
  const sorted = [...years].sort((a, b) => b - a);
  return sorted.length ? sorted : [new Date().getFullYear()];
};

// 指定年月のカテゴリ別内訳（円グラフ用）
export const getMonthlyCategoryBreakdown = (projects, year, month) => {
  const counts = { dev: 0, infra: 0, embedded: 0, other: 0 };

  projects.forEach((project) => {
    if (!project.created_at) return;
    const date = new Date(project.created_at);
    if (date.getFullYear() !== year || date.getMonth() + 1 !== month) return;
    counts[getChartCategory(project)] += 1;
  });

  return CHART_CATEGORY_ORDER.map((category) => ({
    category,
    label: CHART_CATEGORY_LABELS[category],
    value: counts[category],
  }));
};

// 指定年の月別×カテゴリ別件数（棒グラフ用）
export const getYearlyMonthlyCounts = (projects, year) => {
  const monthly = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    dev: 0,
    infra: 0,
    embedded: 0,
    other: 0,
    total: 0,
  }));

  projects.forEach((project) => {
    if (!project.created_at) return;
    const date = new Date(project.created_at);
    if (date.getFullYear() !== year) return;
    const category = getChartCategory(project);
    const entry = monthly[date.getMonth()];
    entry[category] += 1;
    entry.total += 1;
  });

  return monthly;
};
