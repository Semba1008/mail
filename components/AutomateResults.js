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

const STEP_COLUMNS = [
  { key: "aisearch", label: "AI分析" },
  { key: "input_candidated", label: "人材紹介登録" },
  { key: "isclose", label: "募集停止登録" },
  { key: "input_projects", label: "案件情報登録" },
  { key: "lastpass", label: "最終処理" },
];

const PAGE_SIZE = 50;

const FILTERS = [
  { id: "all", label: "すべて" },
  { id: "success", label: "成功のみ" },
  { id: "failure", label: "失敗のみ" },
];

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

const GRANULARITIES = [
  { id: "month", label: "月ごと" },
  { id: "day", label: "日ごと" },
];

function formatPeriodLabel(period, granularity) {
  if (granularity === "month") {
    const [y, m] = period.split("-");
    return `${y}年${Number(m)}月`;
  }
  const [y, m, d] = period.split("-");
  return `${Number(m)}/${Number(d)}`;
}

function aggregateByPeriod(rows, granularity) {
  const map = new Map();

  rows.forEach((row) => {
    const key = getJstDateKey(row.created_at);
    if (!key) return;
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

  return Array.from(map.values())
    .sort((a, b) => a.period.localeCompare(b.period))
    .map((entry) => ({ ...entry, label: formatPeriodLabel(entry.period, granularity) }));
}

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

export default function AutomateResults({ results }) {
  const [filter, setFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [chartGranularity, setChartGranularity] = useState("month");
  const [currentPage, setCurrentPage] = useState(1);

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

  // 検索条件 + 成功/失敗の絞り込みを反映した集合(テーブル表示に使う)
  const filteredRows = useMemo(() => {
    if (filter === "success") return searchedRows.filter((r) => r.allpass);
    if (filter === "failure") return searchedRows.filter((r) => !r.allpass);
    return searchedRows;
  }, [searchedRows, filter]);

  const successCount = searchedRows.filter((r) => r.allpass).length;
  const failureCount = searchedRows.length - successCount;

  useEffect(() => {
    setCurrentPage(1);
  }, [filter, dateFilter, monthFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));

  const currentItems = filteredRows.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const changePage = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  const hasSearch = !!dateFilter || !!monthFilter;
  const clearSearch = () => {
    setDateFilter("");
    setMonthFilter("");
  };

  const chartData = useMemo(
    () => aggregateByPeriod(searchedRows, chartGranularity),
    [searchedRows, chartGranularity]
  );
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

      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <StatCard label={hasSearch ? "該当件数" : "全件数"} value={searchedRows.length} color="#1a365d" />
        <StatCard label="成功" value={successCount} color="#38a169" />
        <StatCard label="失敗" value={failureCount} color="#e53e3e" />
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", gap: 8 }}>
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
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

      <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "16px 16px 4px", marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
          <div style={{ color: "#4a5568", fontWeight: "bold", fontSize: "0.9rem" }}>
            成功・失敗の推移
          </div>
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

        {chartData.length === 0 ? (
          <div style={{ padding: "40px 0", textAlign: "center", color: "#a0aec0" }}>
            データがありません
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <div style={{ width: chartWidth, height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}　barGap = {50}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#edf2f7" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#718096" }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#718096" }} />
                  <Tooltip />
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
                      </div>
                    )}
                  />
                  <Bar dataKey="成功" fill="#38a169" radius={[4, 4, 0, 0]} barSize ={60}>
                    <LabelList
                      dataKey="成功"
                      position="insideBottom"
                      formatter={() => "成功"}
                      fill="#fff"
                      fontSize={11}
                    />
                  </Bar>
                  <Bar dataKey="失敗" fill="#e53e3e" radius={[4, 4, 0, 0]} barSize ={60}>
                    <LabelList
                      dataKey="失敗"
                      position="insideBottom"
                      formatter={() => "失敗"}
                      fill="#fff"
                      fontSize={11}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

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
                    <span style={{ color: "#e53e3e", fontWeight: "bold" }}>
                      {STEP_COLUMNS.filter((col) => !row[col.key])
                        .map((col) => col.label)
                        .join("・") || "詳細不明"}
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
