// automate(自動化バッチ)の実行結果一覧・統計表示コンポーネント (/automate-results)
// 各実行行にはパイプラインの各ステップの成否がbool列で記録されており、
// それを元に成功/失敗件数の集計・期間別推移グラフ・失敗種類別グラフ・一覧テーブルを表示する
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// automateパイプラインの実行ステップ(実行順)。row[key]がfalseになっている
// 最初の列が、そのステップで処理が止まった=失敗原因とみなす
const STEP_COLUMNS = [
  { key: "aisearch", label: "AI分析" },
  { key: "input_candidated", label: "人材紹介登録" },
  { key: "isclose", label: "募集停止登録" },
  { key: "input_projects", label: "案件情報登録" },
  { key: "lastpass", label: "最終処理" },
];

// 結果一覧テーブルの1ページあたりの表示件数
const PAGE_SIZE = 50;

// 結果一覧テーブルの成功/失敗絞り込みボタンの選択肢
const FILTERS = [
  { id: "all", label: "すべて" },
  { id: "success", label: "成功のみ" },
  { id: "failure", label: "失敗のみ" },
];

// created_atを日本語の日時表記(YYYY/MM/DD HH:mm:ss)に変換する(一覧テーブル表示用)
function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

// created_atをJSTの"YYYY-MM-DD"に変換(日付input/月inputの値と直接比較するため)
function getJstDateKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
}

// 成功・失敗推移グラフの集計単位(月ごと/日ごと)の切り替え選択肢
const GRANULARITIES = [
  { id: "month", label: "月ごと" },
  { id: "day", label: "日ごと" },
];

// 集計キー("YYYY-MM"または"YYYY-MM-DD")をグラフ・テーブルの表示用ラベルに変換
function formatPeriodLabel(period, granularity) {
  if (granularity === "month") {
    const [y, m] = period.split("-");
    return `${y}年${Number(m)}月`;
  }
  const [y, m, d] = period.split("-");
  return `${Number(m)}/${Number(d)}`;
}

// 失敗行の原因(最初にfalseになった項目)を返す。原因が特定できない場合はnull
function getFailureStep(row) {
  return STEP_COLUMNS.find((col) => row[col.key] === false) || null;
}

// 失敗行を失敗ステップ(getFailureStepの結果)ごとに集計し、
// 「失敗の種類別件数」グラフ用のデータを作る。件数0の種類は表示しないため除外し、
// 件数の多い順に並べ替える
function aggregateByFailureType(rows) {
  const counts = new Map(STEP_COLUMNS.map((c) => [c.key, 0]));
  let unknown = 0;

  rows.forEach((row) => {
    if (row.allpass) return;
    const step = getFailureStep(row);
    if (step) {
      counts.set(step.key, counts.get(step.key) + 1);
    } else {
      // どのステップ列もfalseになっていない=原因が特定できない失敗として別枠集計
      unknown += 1;
    }
  });

  const data = STEP_COLUMNS.map((c) => ({ key: c.key, label: c.label, count: counts.get(c.key) }));
  if (unknown > 0) {
    data.push({ key: "unknown", label: "詳細不明", count: unknown });
  }
  return data.filter((d) => d.count > 0).sort((a, b) => b.count - a.count);
}

// created_at(JST日付)を月/日単位でグルーピングし、期間ごとの成功・失敗件数を集計する。
// 「成功・失敗の推移」グラフおよびその下の集計テーブルの元データになる
function aggregateByPeriod(rows, granularity) {
  const map = new Map();

  rows.forEach((row) => {
    const key = getJstDateKey(row.created_at);
    if (!key) return;
    // 月ごと表示の場合は"YYYY-MM"に切り詰めて同月のデータをまとめる
    const period = granularity === "month" ? key.slice(0, 7) : key;

    if (!map.has(period)) {
      map.set(period, { period, 成功: 0, 失敗: 0 });
    }
    const entry = map.get(period);
    if (row.allpass) {
      entry.成功 += 1;
    } else {
      entry.失敗 += 1;
    }
  });

  // 期間の昇順(古い→新しい)に並べ、グラフ/テーブル表示用のラベルを付与する
  return Array.from(map.values())
    .sort((a, b) => a.period.localeCompare(b.period))
    .map((entry) => ({ ...entry, label: formatPeriodLabel(entry.period, granularity) }));
}

// 全件数/成功/失敗の件数を表示する小さなカードUI
function StatCard({ label, value, color }) {
  return (
    <div
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: 8,
        padding: "10px 18px",
        minWidth: 100,
      }}
    >
      <div style={{ color: "#718096", fontSize: "0.75rem", fontWeight: "bold" }}>
        {label}
      </div>
      <div style={{ color, fontSize: "1.4rem", fontWeight: "bold" }}>{value}</div>
    </div>
  );
}

// automate実行結果一覧ページ本体。呼び出し元(pages/automate-results.js)から
// 全件取得済みのresults配列を受け取り、絞り込み・集計・ページングはすべてクライアント側で行う
export default function AutomateResults({ results }) {
  // 成功/失敗の絞り込み("すべて"/"成功のみ"/"失敗のみ")
  const [filter, setFilter] = useState("all");
  // 失敗の種類による絞り込み(STEP_COLUMNSのkeyまたは"unknown"/"all")
  const [failureTypeFilter, setFailureTypeFilter] = useState("all");
  // 日付/月による絞り込み(どちらか片方のみ有効。互いに排他)
  const [dateFilter, setDateFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  // 「成功・失敗の推移」グラフの集計単位(月ごと/日ごと)
  const [chartGranularity, setChartGranularity] = useState("month");
  // 結果一覧テーブルの現在ページ
  const [currentPage, setCurrentPage] = useState(1);

  // 受け取ったresultsを直接使わず、created_atの新しい順にソートしたコピーを保持する
  const rows = useMemo(() => {
    return [...results].sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at)
    );
  }, [results]);

  // 日付・月の検索条件のみを反映した集合(件数表示に使う)
  const searchedRows = useMemo(() => {
    return rows.filter((r) => {
      const key = getJstDateKey(r.created_at);
      if (dateFilter && key !== dateFilter) return false;
      if (monthFilter && (key || "").slice(0, 7) !== monthFilter) return false;
      return true;
    });
  }, [rows, dateFilter, monthFilter]);

  // 検索条件 + 成功/失敗 + 失敗種類の絞り込みを反映した集合(テーブル表示に使う)
  const filteredRows = useMemo(() => {
    let list = searchedRows;
    if (filter === "success") list = list.filter((r) => r.allpass);
    if (filter === "failure") list = list.filter((r) => !r.allpass);
    if (failureTypeFilter !== "all") {
      list = list.filter(
        (r) => !r.allpass && (getFailureStep(r)?.key || "unknown") === failureTypeFilter
      );
    }
    return list;
  }, [searchedRows, filter, failureTypeFilter]);

  // 統計カード表示用の成功/失敗件数。日付・月の検索条件のみを反映したsearchedRowsから算出する
  // (成功/失敗フィルタ自体の影響は受けず、常に検索条件内の全体件数を示す)
  const successCount = searchedRows.filter((r) => r.allpass).length;
  const failureCount = searchedRows.length - successCount;

  // 「失敗の種類別件数」グラフ用データ。こちらも検索条件のみを反映したsearchedRowsが元になる
  const failureTypeData = useMemo(
    () => aggregateByFailureType(searchedRows),
    [searchedRows]
  );

  // 絞り込み条件が変わったら表示中のページを1ページ目に戻す
  // (古いページ番号のまま件数が減ると空ページになってしまうため)
  useEffect(() => {
    setCurrentPage(1);
  }, [filter, failureTypeFilter, dateFilter, monthFilter]);

  // 失敗の種類を選択したら、成功/失敗フィルタも自動的に「失敗のみ」に切り替える
  // (「すべて」や「成功のみ」のまま失敗種類を選ぶと表示が矛盾するため)
  const handleFailureTypeChange = (value) => {
    setFailureTypeFilter(value);
    if (value !== "all") {
      setFilter("failure");
    }
  };

  // ページング計算。件数が0でも最低1ページは表示する
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));

  const currentItems = filteredRows.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const changePage = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  // 日付/月のいずれかが指定されていれば「検索中」とみなす
  const hasSearch = !!dateFilter || !!monthFilter;
  const clearSearch = () => {
    setDateFilter("");
    setMonthFilter("");
  };

  // 「成功・失敗の推移」グラフのデータは、テーブルと同じfilteredRows(検索+成功/失敗+失敗種類の
  // 絞り込み済み)を元に集計する。フィルタで絞った内容がそのままグラフにも反映される
  const chartData = useMemo(
    () => aggregateByPeriod(filteredRows, chartGranularity),
    [filteredRows, chartGranularity]
  );
  // 成功/失敗フィルタに応じて、グラフ・テーブルに表示する系列を切り替える
  // (例えば「失敗のみ」の時は成功バー・成功列を非表示にする)
  const showSuccessBar = filter !== "failure";
  const showFailureBar = filter !== "success";
  // 期間の件数が多いほどグラフ幅を広げ、横スクロールで見やすくする
  const chartWidth = Math.max(600, chartData.length * (chartGranularity === "day" ? 60 : 120));

  return (
    <div
      style={{
        maxWidth: 1000,
        margin: "0 auto",
        padding: "30px 20px",
      }}
    >
      <Link
        href="/"
        style={{
          display: "inline-block",
          marginBottom: 16,
          color: "#3182ce",
          fontWeight: "bold",
          fontSize: "0.9rem",
          textDecoration: "none",
        }}
      >
        ← 案件一覧に戻る
      </Link>

      <h2 style={{ fontSize: "1.3rem", color: "#1a365d", marginBottom: 20 }}>
        automateの実行結果
      </h2>

      {/* 全件数(または検索中は該当件数)・成功・失敗の件数サマリー */}
      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <StatCard label={hasSearch ? "該当件数" : "全件数"} value={searchedRows.length} color="#1a365d" />
        <StatCard label="成功" value={successCount} color="#38a169" />
        <StatCard label="失敗" value={failureCount} color="#e53e3e" />
      </div>

      {/* 絞り込み操作行: 成功/失敗フィルタ・失敗種類セレクト・日付/月検索・検索クリア */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        {/* 成功/失敗フィルタボタン。「失敗のみ」以外を選んだ場合は失敗種類の絞り込みも解除する */}
        <div style={{ display: "flex", gap: 8 }}>
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => {
                setFilter(f.id);
                if (f.id !== "failure") setFailureTypeFilter("all");
              }}
              style={{
                padding: "8px 16px",
                borderRadius: 6,
                border: "1px solid",
                borderColor: filter === f.id ? "#00bfa5" : "#cbd5e0",
                backgroundColor: filter === f.id ? "#00bfa5" : "#fff",
                color: filter === f.id ? "#fff" : "#4a5568",
                fontWeight: "bold",
                cursor: "pointer",
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* 失敗の種類による絞り込みセレクト(選択すると成功/失敗フィルタも「失敗のみ」に切り替わる) */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <label style={{ color: "#718096", fontSize: "0.8rem", fontWeight: "bold" }}>
            失敗の種類
          </label>
          <select
            value={failureTypeFilter}
            onChange={(e) => handleFailureTypeChange(e.target.value)}
            style={inputStyle}
          >
            <option value="all">すべて</option>
            {STEP_COLUMNS.map((col) => (
              <option key={col.key} value={col.key}>
                {col.label}
              </option>
            ))}
            <option value="unknown">詳細不明</option>
          </select>
        </div>

        {/* 日付検索。入力すると月検索側はクリアする(日付/月は排他) */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <label style={{ color: "#718096", fontSize: "0.8rem", fontWeight: "bold" }}>
            日付
          </label>
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => {
              setDateFilter(e.target.value);
              setMonthFilter("");
            }}
            style={inputStyle}
          />
        </div>

        {/* 月検索。入力すると日付検索側はクリアする(日付/月は排他) */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <label style={{ color: "#718096", fontSize: "0.8rem", fontWeight: "bold" }}>
            月
          </label>
          <input
            type="month"
            value={monthFilter}
            onChange={(e) => {
              setMonthFilter(e.target.value);
              setDateFilter("");
            }}
            style={inputStyle}
          />
        </div>

        {/* 日付/月のいずれかが指定されている時だけ表示する検索クリアボタン */}
        {hasSearch && (
          <button
            onClick={clearSearch}
            style={{
              padding: "6px 14px",
              borderRadius: 6,
              border: "1px solid #cbd5e0",
              backgroundColor: "#fff",
              color: "#4a5568",
              fontWeight: "bold",
              cursor: "pointer",
              fontSize: "0.8rem",
            }}
          >
            検索条件をクリア
          </button>
        )}
      </div>

      {/* 「成功・失敗の推移」棒グラフ + 集計テーブル(filteredRowsを月/日単位で集計) */}
      <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "16px 16px 4px", marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
          <div style={{ color: "#4a5568", fontWeight: "bold", fontSize: "0.9rem" }}>
            成功・失敗の推移
          </div>
          {/* 集計単位(月ごと/日ごと)の切り替えボタン */}
          <div style={{ display: "flex", gap: 8 }}>
            {GRANULARITIES.map((g) => (
              <button
                key={g.id}
                onClick={() => setChartGranularity(g.id)}
                style={{
                  padding: "6px 14px",
                  borderRadius: 6,
                  border: "1px solid",
                  borderColor: chartGranularity === g.id ? "#00bfa5" : "#cbd5e0",
                  backgroundColor: chartGranularity === g.id ? "#00bfa5" : "#fff",
                  color: chartGranularity === g.id ? "#fff" : "#4a5568",
                  fontWeight: "bold",
                  cursor: "pointer",
                  fontSize: "0.8rem",
                }}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>

        {/* データが無い場合はグラフ・テーブルの代わりにプレースホルダーを表示 */}
        {chartData.length === 0 ? (
          <div style={{ padding: "40px 0", textAlign: "center", color: "#a0aec0" }}>
            データがありません
          </div>
        ) : (
          // 期間数に応じてchartWidthを可変にしているため、はみ出す分は横スクロールで見せる
          <div style={{ overflowX: "auto" }}>
            <div style={{ width: chartWidth, height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}　barGap = {50}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#edf2f7" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#718096" }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#718096" }} />
                  <Tooltip />
                  {/* recharts標準の凡例だと表示/非表示の切り替えが難しいため、
                      showSuccessBar/showFailureBarに応じた自前の凡例を描画する */}
                  <Legend
                    content={() => (
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "center",
                          gap: 16,
                          fontSize: "0.8rem",
                          color: "#4a5568",
                          paddingTop: 8,
                        }}
                      >
                        {showSuccessBar && (
                          <span>
                            <span
                              style={{
                                display: "inline-block",
                                width: 10,
                                height: 10,
                                backgroundColor: "#38a169",
                                marginRight: 5,
                                borderRadius: 2,
                              }}
                            />
                            成功
                          </span>
                        )}
                        {showFailureBar && (
                          <span>
                            <span
                              style={{
                                display: "inline-block",
                                width: 10,
                                height: 10,
                                backgroundColor: "#e53e3e",
                                marginRight: 5,
                                borderRadius: 2,
                              }}
                            />
                            失敗
                          </span>
                        )}
                      </div>
                    )}
                  />
                  {/* 成功/失敗フィルタに合わせて、対応するバー自体を出し分ける */}
                  {showSuccessBar && (
                    <Bar dataKey="成功" fill="#38a169" radius={[4, 4, 0, 0]} barSize ={60}>
                      <LabelList
                        dataKey="成功"
                        position="insideBottom"
                        formatter={() => "成功"}
                        fill="#fff"
                        fontSize={11}
                      />
                    </Bar>
                  )}
                  {showFailureBar && (
                    <Bar dataKey="失敗" fill="#e53e3e" radius={[4, 4, 0, 0]} barSize ={60}>
                      <LabelList
                        dataKey="失敗"
                        position="insideBottom"
                        formatter={() => "失敗"}
                        fill="#fff"
                        fontSize={11}
                      />
                    </Bar>
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* グラフと同じchartDataを使った、期間別の件数一覧テーブル(グラフの下に併記) */}
        {chartData.length > 0 && (
          <div style={{ overflowX: "auto", marginTop: 12 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, backgroundColor: "transparent", borderBottom: "1px solid #e2e8f0" }}>
                    期間
                  </th>
                  {showSuccessBar && (
                    <th
                      style={{
                        ...thStyle,
                        backgroundColor: "transparent",
                        borderBottom: "1px solid #e2e8f0",
                        color: "#38a169",
                        textAlign: "right",
                      }}
                    >
                      成功
                    </th>
                  )}
                  {showFailureBar && (
                    <th
                      style={{
                        ...thStyle,
                        backgroundColor: "transparent",
                        borderBottom: "1px solid #e2e8f0",
                        color: "#e53e3e",
                        textAlign: "right",
                      }}
                    >
                      失敗
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {chartData.map((entry) => (
                  <tr key={entry.period} style={{ borderTop: "1px solid #f1f5f9" }}>
                    <td style={tdStyle}>{entry.label}</td>
                    {showSuccessBar && (
                      <td style={{ ...tdStyle, textAlign: "right", color: "#38a169", fontWeight: "bold" }}>
                        {entry.成功}
                      </td>
                    )}
                    {showFailureBar && (
                      <td style={{ ...tdStyle, textAlign: "right", color: "#e53e3e", fontWeight: "bold" }}>
                        {entry.失敗}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 「失敗の種類別件数」横棒グラフ(searchedRowsを失敗ステップごとに集計したfailureTypeDataを使用) */}
      <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "16px 16px 8px", marginBottom: 24 }}>
        <div style={{ color: "#4a5568", fontWeight: "bold", fontSize: "0.9rem", marginBottom: 8 }}>
          失敗の種類別件数
        </div>

        {failureTypeData.length === 0 ? (
          <div style={{ padding: "40px 0", textAlign: "center", color: "#a0aec0" }}>
            データがありません
          </div>
        ) : (
          <div style={{ height: Math.max(80, failureTypeData.length * 40) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={failureTypeData}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#edf2f7" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "#718096" }} />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={110}
                  tick={{ fontSize: 12, fill: "#4a5568" }}
                />
                <Tooltip />
                <Bar dataKey="count" fill="#e53e3e" radius={[0, 4, 4, 0]} barSize={22}>
                  <LabelList
                    dataKey="count"
                    position="right"
                    fill="#4a5568"
                    fontSize={12}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* 実行結果の一覧テーブル(PAGE_SIZE件ずつページング表示)。
          ページ送りボタンは「結果」列のヘッダー内にまとめて配置している */}
      <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 8 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
          <thead>
            <tr style={{ backgroundColor: "#f7fafc" }}>
              <th style={thStyle}>ID</th>
              <th style={thStyle}>日時</th>
              <th style={thStyle}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
                  <span>結果</span>
                  {/* 前へ/次へページ送りボタン(先頭・末尾では非活性化) */}
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <button
                      onClick={() => changePage(Math.max(currentPage - 1, 1))}
                      disabled={currentPage === 1}
                      title="前のページ"
                      style={{
                        border: "1px solid #cbd5e0",
                        borderRadius: 4,
                        background: "#fff",
                        color: "#4a5568",
                        cursor: currentPage === 1 ? "not-allowed" : "pointer",
                        opacity: currentPage === 1 ? 0.4 : 1,
                        padding: "2px 8px",
                        fontSize: "0.8rem",
                      }}
                    >
                      ◁
                    </button>
                    <span style={{ fontWeight: "normal", color: "#718096", fontSize: "0.78rem" }}>
                      {currentPage} / {totalPages}
                    </span>
                    <button
                      onClick={() => changePage(Math.min(currentPage + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      title="次のページ"
                      style={{
                        border: "1px solid #cbd5e0",
                        borderRadius: 4,
                        background: "#fff",
                        color: "#4a5568",
                        cursor: currentPage === totalPages ? "not-allowed" : "pointer",
                        opacity: currentPage === totalPages ? 0.4 : 1,
                        padding: "2px 8px",
                        fontSize: "0.8rem",
                      }}
                    >
                      ▷
                    </button>
                  </span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {currentItems.length === 0 && (
              <tr>
                <td
                  colSpan={3}
                  style={{ ...tdStyle, textAlign: "center", color: "#a0aec0" }}
                >
                  データがありません
                </td>
              </tr>
            )}
            {currentItems.map((row) => (
              <tr key={row.id} style={{ borderTop: "1px solid #e2e8f0" }}>
                <td style={{ ...tdStyle, color: "#a0aec0", fontSize: "0.78rem" }}>{row.id}</td>
                <td style={tdStyle}>{formatDateTime(row.created_at)}</td>
                <td style={{ ...tdStyle, whiteSpace: "normal" }}>
                  {row.allpass ? (
                    <span style={{ color: "#38a169", fontWeight: "bold" }}>成功</span>
                  ) : (
                    // STEP_COLUMNSを順に見て最初にfalseになっている列を失敗原因として表示する
                    // (getFailureStepと同じロジックをここでも使用。該当なしは「詳細不明」)
                    <span style={{ color: "#e53e3e", fontWeight: "bold" }}>
                      {(STEP_COLUMNS.find((col) => row[col.key] === false)?.label) || "詳細不明"}
                      {" "}で失敗
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// テーブル・入力欄で使い回す共通スタイル定義
const thStyle = {
  textAlign: "left",
  padding: "10px 12px",
  color: "#4a5568",
  fontWeight: "bold",
  whiteSpace: "nowrap",
};

const tdStyle = {
  padding: "10px 12px",
  color: "#2d3748",
  whiteSpace: "nowrap",
};

const inputStyle = {
  padding: "6px 10px",
  borderRadius: 6,
  border: "1px solid #cbd5e0",
  color: "#2d3748",
  fontSize: "0.85rem",
};
