import { regionalPrefectures } from "../constants/regions";
import { normalize } from "./format";

// グラフ集計専用のカテゴリ判定・集計ロジック
// 既存の utils/project.js の getProjectCategories はサイドバー絞り込みで使用中のため、
// 挙動を変えないようこちらは独立した関数として定義する（未分類は "その他" 扱い）。
export const getChartCategory = (project) => {
  const text = `${project.category}`.toLowerCase();
  if (/業務系/i.test(text)) return "dev";
  if (/インフラ/i.test(text)) return "infra";
  if (/組み込み/i.test(text)) return "embedded";
  return "other";
};

export const CHART_CATEGORY_ORDER = ["dev", "infra", "embedded", "other"];

export const CHART_CATEGORY_LABELS = {
  dev: "業務系",
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

// グラフの地域絞り込み選択肢（メイン画面の地域タブと同じ地域区分）
export const CHART_REGIONS = ["すべて", ...regionalPrefectures.map((r) => r.region)];

// 指定地域に属する案件のみを抽出（メイン画面のフィルタリングと同じロジック）
export const filterProjectsByRegion = (projects, region) => {
  if (!region || region === "すべて") return projects;

  const currentRegionData = regionalPrefectures.find((r) => r.region === region);
  if (!currentRegionData) return projects;

  const allowedPrefsNormalized = currentRegionData.prefs.map(normalize);

  return projects.filter((project) => {
    const projectPrefNormalized = normalize((project.location || "").trim());
    return allowedPrefsNormalized.some((pref) =>
      projectPrefNormalized.startsWith(pref),
    );
  });
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

// 指定年（および月）に該当する案件そのものを抽出（CSV書き出し用）
export const filterProjectsByPeriod = (projects, year, month) => {
  return projects.filter((project) => {
    if (!project.created_at) return false;
    const date = new Date(project.created_at);
    if (date.getFullYear() !== year) return false;
    if (month != null && date.getMonth() + 1 !== month) return false;
    return true;
  });
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

const escapeCsvField = (value) => {
  const str = String(value ?? "");
  return /[",\r\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
};

// 案件一覧(生データ)からCSVのBlobを生成する。手動書き出し・自動書き出し双方から利用する。
export const buildProjectsCsvBlob = (projectsList) => {
  const header = [
    "ID",
    "案件名",
    "カテゴリ",
    "場所",
    "単価",
    "期間",
    "募集期限",
    "スキル",
    "登録日",
  ];

  const rows = [
    header,
    ...projectsList.map((project) => [
      project.id,
      project.title,
      CHART_CATEGORY_LABELS[getChartCategory(project)],
      project.location,
      project.price,
      project.period,
      project.end_date,
      project.skills,
      project.created_at,
    ]),
  ];

  const csvContent = rows
    .map((row) => row.map(escapeCsvField).join(","))
    .join("\r\n");

  return new Blob([`${String.fromCharCode(0xfeff)}${csvContent}`], {
    type: "text/csv;charset=utf-8;",
  });
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
