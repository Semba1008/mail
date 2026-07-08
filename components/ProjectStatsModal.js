import { useMemo, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { styles } from "../styles/index.styles";
import {
  CHART_CATEGORY_COLORS,
  CHART_CATEGORY_LABELS,
  CHART_CATEGORY_ORDER,
  getAvailableYears,
  getMonthlyCategoryBreakdown,
  getYearlyMonthlyCounts,
} from "../utils/projectStats";

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

export default function ProjectStatsModal({ projects, onClose }) {
  const now = new Date();
  const availableYears = useMemo(() => getAvailableYears(projects), [projects]);

  const [activeChart, setActiveChart] = useState("pie");
  const [selectedYear, setSelectedYear] = useState(
    availableYears.includes(now.getFullYear())
      ? now.getFullYear()
      : availableYears[0],
  );
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [isExporting, setIsExporting] = useState(false);

  const chartRef = useRef(null);

  const pieData = useMemo(
    () => getMonthlyCategoryBreakdown(projects, selectedYear, selectedMonth),
    [projects, selectedYear, selectedMonth],
  );
  const barData = useMemo(
    () => getYearlyMonthlyCounts(projects, selectedYear),
    [projects, selectedYear],
  );

  const pieTotal = pieData.reduce((sum, entry) => sum + entry.value, 0);

  const fileLabel =
    activeChart === "pie"
      ? `${selectedYear}年${selectedMonth}月_月別内訳`
      : `${selectedYear}年_年間推移`;

  const handleExportPdf = async () => {
    if (!chartRef.current) return;
    setIsExporting(true);
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);

      const canvas = await html2canvas(chartRef.current, { scale: 2 });
      const imgData = canvas.toDataURL("image/png");

      const pdf = new jsPDF({ orientation: "landscape" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const imgWidth = pageWidth - 20;
      const imgHeight = (canvas.height / canvas.width) * imgWidth;

      pdf.setFontSize(14);
      pdf.text(`案件統計 - ${fileLabel}`, 10, 15);
      pdf.addImage(imgData, "PNG", 10, 20, imgWidth, imgHeight);

      let cursorY = 20 + imgHeight + 10;
      pdf.setFontSize(11);
      if (activeChart === "pie") {
        pdf.text("カテゴリ / 件数", 10, cursorY);
        cursorY += 7;
        pieData.forEach((entry) => {
          pdf.text(`${entry.label}: ${entry.value} 件`, 10, cursorY);
          cursorY += 6;
        });
      } else {
        pdf.text("月 / 開発 / インフラ / 組み込み / その他 / 合計", 10, cursorY);
        cursorY += 7;
        barData.forEach((entry) => {
          pdf.text(
            `${entry.month}月: ${entry.dev} / ${entry.infra} / ${entry.embedded} / ${entry.other} / 合計${entry.total}`,
            10,
            cursorY,
          );
          cursorY += 6;
        });
      }

      pdf.save(`案件統計_${fileLabel}.pdf`);
    } catch (error) {
      console.error("PDF書き出しエラー:", error);
      alert("PDFの書き出しに失敗しました。");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportExcel = async () => {
    if (!chartRef.current) return;
    setIsExporting(true);
    try {
      const [{ default: html2canvas }, ExcelJS] = await Promise.all([
        import("html2canvas"),
        import("exceljs"),
      ]);

      const canvas = await html2canvas(chartRef.current, { scale: 2 });
      const imgBase64 = canvas.toDataURL("image/png").split(",")[1];

      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("案件統計");

      sheet.getCell("A1").value = `案件統計 - ${fileLabel}`;
      sheet.getCell("A1").font = { bold: true, size: 14 };

      if (activeChart === "pie") {
        sheet.getRow(3).values = ["カテゴリ", "件数"];
        pieData.forEach((entry, i) => {
          sheet.getRow(4 + i).values = [entry.label, entry.value];
        });
      } else {
        sheet.getRow(3).values = [
          "月",
          "開発",
          "インフラ",
          "組み込み",
          "その他",
          "合計",
        ];
        barData.forEach((entry, i) => {
          sheet.getRow(4 + i).values = [
            `${entry.month}月`,
            entry.dev,
            entry.infra,
            entry.embedded,
            entry.other,
            entry.total,
          ];
        });
      }

      const imageId = workbook.addImage({
        base64: imgBase64,
        extension: "png",
      });
      const anchorCol = activeChart === "pie" ? 4 : 8;
      sheet.addImage(imageId, {
        tl: { col: anchorCol, row: 2 },
        ext: { width: 480, height: 320 },
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `案件統計_${fileLabel}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Excel書き出しエラー:", error);
      alert("Excelの書き出しに失敗しました。");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div
        style={{ ...styles.modalContent, maxWidth: 900 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ fontSize: "1.3rem", color: "#1a365d", marginBottom: 20 }}>
          案件情報グラフ
        </h2>

        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {[
            { id: "pie", label: "月別内訳（円グラフ）" },
            { id: "bar", label: "年間推移（棒グラフ）" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveChart(tab.id)}
              style={{
                padding: "8px 16px",
                borderRadius: 6,
                border: "1px solid",
                borderColor: activeChart === tab.id ? "#00bfa5" : "#cbd5e0",
                backgroundColor: activeChart === tab.id ? "#00bfa5" : "#fff",
                color: activeChart === tab.id ? "#fff" : "#4a5568",
                cursor: "pointer",
                fontWeight: "bold",
                fontSize: "0.85rem",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div
          style={{
            display: "flex",
            gap: 16,
            alignItems: "center",
            marginBottom: 20,
            flexWrap: "wrap",
          }}
        >
          <label style={{ fontSize: "0.85rem", fontWeight: "bold" }}>
            年:{" "}
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              style={{ padding: 6, borderRadius: 6, border: "1px solid #cbd5e0" }}
            >
              {availableYears.map((year) => (
                <option key={year} value={year}>
                  {year}年
                </option>
              ))}
            </select>
          </label>

          {activeChart === "pie" && (
            <label style={{ fontSize: "0.85rem", fontWeight: "bold" }}>
              月:{" "}
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                style={{
                  padding: 6,
                  borderRadius: 6,
                  border: "1px solid #cbd5e0",
                }}
              >
                {MONTHS.map((month) => (
                  <option key={month} value={month}>
                    {month}月
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        <div
          ref={chartRef}
          style={{
            backgroundColor: "#fff",
            padding: 20,
            borderRadius: 10,
            border: "1px solid #edf2f7",
          }}
        >
          <div style={{ width: "100%", height: 320 }}>
            <ResponsiveContainer>
              {activeChart === "pie" ? (
                pieTotal === 0 ? (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      height: "100%",
                      color: "#a0aec0",
                    }}
                  >
                    該当期間のデータがありません
                  </div>
                ) : (
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="label"
                      cx="50%"
                      cy="50%"
                      outerRadius={110}
                      label={(entry) => `${entry.label}: ${entry.value}`}
                    >
                      {pieData.map((entry) => (
                        <Cell
                          key={entry.category}
                          fill={CHART_CATEGORY_COLORS[entry.category]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                )
              ) : (
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tickFormatter={(m) => `${m}月`} />
                  <YAxis allowDecimals={false} />
                  <Tooltip labelFormatter={(m) => `${m}月`} />
                  <Legend />
                  {CHART_CATEGORY_ORDER.map((category) => (
                    <Bar
                      key={category}
                      dataKey={category}
                      name={CHART_CATEGORY_LABELS[category]}
                      stackId="category"
                      fill={CHART_CATEGORY_COLORS[category]}
                    />
                  ))}
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>

          <table
            style={{
              width: "100%",
              marginTop: 20,
              borderCollapse: "collapse",
              fontSize: "0.85rem",
            }}
          >
            <thead>
              <tr>
                {(activeChart === "pie"
                  ? ["カテゴリ", "件数"]
                  : ["月", "開発", "インフラ", "組み込み", "その他", "合計"]
                ).map((head) => (
                  <th
                    key={head}
                    style={{
                      textAlign: "left",
                      borderBottom: "2px solid #e2e8f0",
                      padding: "6px 8px",
                      color: "#4a5568",
                    }}
                  >
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activeChart === "pie"
                ? pieData.map((entry) => (
                    <tr key={entry.category}>
                      <td style={{ padding: "6px 8px" }}>{entry.label}</td>
                      <td style={{ padding: "6px 8px" }}>{entry.value} 件</td>
                    </tr>
                  ))
                : barData.map((entry) => (
                    <tr key={entry.month}>
                      <td style={{ padding: "6px 8px" }}>{entry.month}月</td>
                      <td style={{ padding: "6px 8px" }}>{entry.dev}</td>
                      <td style={{ padding: "6px 8px" }}>{entry.infra}</td>
                      <td style={{ padding: "6px 8px" }}>{entry.embedded}</td>
                      <td style={{ padding: "6px 8px" }}>{entry.other}</td>
                      <td style={{ padding: "6px 8px", fontWeight: "bold" }}>
                        {entry.total}
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>

        <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
          <button
            onClick={handleExportPdf}
            disabled={isExporting}
            style={{
              ...styles.primaryButton,
              opacity: isExporting ? 0.6 : 1,
              cursor: isExporting ? "not-allowed" : "pointer",
            }}
          >
            PDFで書き出し
          </button>
          <button
            onClick={handleExportExcel}
            disabled={isExporting}
            style={{
              ...styles.secondaryButton,
              opacity: isExporting ? 0.6 : 1,
              cursor: isExporting ? "not-allowed" : "pointer",
            }}
          >
            Excelで書き出し
          </button>
        </div>
      </div>
    </div>
  );
}
