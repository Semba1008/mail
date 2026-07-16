import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
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
  CHART_REGIONS,
  buildProjectsCsvBlob,
  filterProjectsByPeriod,
  filterProjectsByRegion,
  getAvailableYears,
  getMonthlyCategoryBreakdown,
  getYearlyMonthlyCounts,
} from "../utils/projectStats";
import { saveFile } from "../utils/saveFile";
import {
  clearDirectoryHandle,
  getAutoExportEnabled,
  isAutoExportSupported,
  loadDirectoryHandle,
  requestDirectoryPermission,
  saveDirectoryHandle,
  setAutoExportEnabled,
} from "../utils/autoExport";
import { useAutoExportWatcher } from "../utils/useAutoExportWatcher";

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

const groupLabelStyle = {
  fontSize: "0.75rem",
  fontWeight: "bold",
  color: "#4a5568",
  marginBottom: 6,
};

const controlBoxStyle = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  border: "1px solid #cbd5e0",
  borderRadius: 8,
  padding: "6px 10px",
  minHeight: 20,
};

const selectInnerStyle = {
  border: "none",
  outline: "none",
  background: "transparent",
  fontSize: "0.85rem",
  fontWeight: "bold",
  cursor: "pointer",
};

export default function ProjectStats({ projects }) {
  const now = new Date();

  const [activeChart, setActiveChart] = useState("pie");
  const [selectedRegion, setSelectedRegion] = useState("すべて");
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [isExporting, setIsExporting] = useState(false);

  const [autoSupported, setAutoSupported] = useState(false);
  const [autoEnabled, setAutoEnabled] = useState(false);
  const [autoFolderName, setAutoFolderName] = useState("");
  const [autoNeedsReauth, setAutoNeedsReauth] = useState(false);
  const [autoNotice, setAutoNotice] = useState("");

  const regionFilteredProjects = useMemo(
    () => filterProjectsByRegion(projects, selectedRegion),
    [projects, selectedRegion],
  );

  const availableYears = useMemo(
    () => getAvailableYears(regionFilteredProjects),
    [regionFilteredProjects],
  );

  const [selectedYear, setSelectedYear] = useState(
    availableYears.includes(now.getFullYear())
      ? now.getFullYear()
      : availableYears[0],
  );

  useEffect(() => {
    if (!availableYears.includes(selectedYear)) {
      setSelectedYear(availableYears[0]);
    }
  }, [availableYears, selectedYear]);

  const chartRef = useRef(null);

  const handleAutoExportResult = (result) => {
    if (result.type === "needs-reauth") {
      setAutoNeedsReauth(true);
      return;
    }
    setAutoNeedsReauth(false);
    setAutoNotice(result.message);
    if (
      result.type === "success" &&
      typeof Notification !== "undefined" &&
      Notification.permission === "granted"
    ) {
      new Notification("案件データの自動書き出し", { body: result.message });
    }
  };

  const { runCheckNow } = useAutoExportWatcher(projects, {
    onResult: handleAutoExportResult,
  });

  useEffect(() => {
    if (!isAutoExportSupported()) return;
    setAutoSupported(true);
    setAutoEnabled(getAutoExportEnabled());

    (async () => {
      const handle = await loadDirectoryHandle().catch(() => null);
      if (handle) setAutoFolderName(handle.name);
    })();
  }, []);

  const handleChooseAutoFolder = async () => {
    try {
      const handle = await window.showDirectoryPicker({ mode: "readwrite" });
      await saveDirectoryHandle(handle);
      setAutoFolderName(handle.name);
      setAutoNeedsReauth(false);
      setAutoNotice(`保存先フォルダを「${handle.name}」に設定しました。`);
    } catch (error) {
      if (error?.name !== "AbortError") {
        console.error("フォルダ設定エラー:", error);
      }
    }
  };

  const handleClearAutoFolder = async () => {
    await clearDirectoryHandle().catch(() => {});
    setAutoFolderName("");
    setAutoNeedsReauth(false);
    setAutoEnabled(false);
    setAutoExportEnabled(false);
    setAutoNotice("保存先フォルダの設定を解除しました。");
  };

  const handleToggleAutoEnabled = async (checked) => {
    setAutoEnabled(checked);
    setAutoExportEnabled(checked);
    if (checked && typeof Notification !== "undefined" && Notification.permission === "default") {
      await Notification.requestPermission().catch(() => {});
    }
    if (checked) await runCheckNow();
  };

  const handleReauthorizeFolder = async () => {
    const handle = await loadDirectoryHandle().catch(() => null);
    if (!handle) return;
    const granted = await requestDirectoryPermission(handle).catch(() => false);
    if (granted) {
      setAutoNeedsReauth(false);
      await runCheckNow();
    }
  };

  const pieData = useMemo(
    () =>
      getMonthlyCategoryBreakdown(
        regionFilteredProjects,
        selectedYear,
        selectedMonth,
      ),
    [regionFilteredProjects, selectedYear, selectedMonth],
  );
  const barData = useMemo(
    () => getYearlyMonthlyCounts(regionFilteredProjects, selectedYear),
    [regionFilteredProjects, selectedYear],
  );

  const pieTotal = pieData.reduce((sum, entry) => sum + entry.value, 0);

  const csvProjects = useMemo(
    () =>
      activeChart === "pie"
        ? filterProjectsByPeriod(regionFilteredProjects, selectedYear, selectedMonth)
        : filterProjectsByPeriod(regionFilteredProjects, selectedYear),
    [regionFilteredProjects, activeChart, selectedYear, selectedMonth],
  );

  const regionSuffix = selectedRegion !== "すべて" ? `_${selectedRegion}` : "";
  const fileLabel =
    (activeChart === "pie"
      ? `${selectedYear}年${selectedMonth}月_月別内訳`
      : `${selectedYear}年_年間推移`) + regionSuffix;

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
        pdf.text("月 / 業務系 / インフラ / 組み込み / その他 / 合計", 10, cursorY);
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

      const blob = pdf.output("blob");
      await saveFile(blob, `案件統計_${fileLabel}.pdf`, {
        types: [
          { description: "PDFファイル", accept: { "application/pdf": [".pdf"] } },
        ],
      });
    } catch (error) {
      console.error("PDF書き出しエラー:", error);
      alert("PDFの書き出しに失敗しました。");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportCsv = async () => {
    setIsExporting(true);
    const blob = buildProjectsCsvBlob(csvProjects);

    try {
      await saveFile(blob, `案件一覧_${fileLabel}.csv`, {
        types: [{ description: "CSVファイル", accept: { "text/csv": [".csv"] } }],
      });
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
          "業務系",
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

      await saveFile(blob, `案件統計_${fileLabel}.xlsx`, {
        types: [
          {
            description: "Excelファイル",
            accept: {
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
                [".xlsx"],
            },
          },
        ],
      });
    } catch (error) {
      console.error("Excel書き出しエラー:", error);
      alert("Excelの書き出しに失敗しました。");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div
      style={{
        maxWidth: 900,
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
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 16,
          marginBottom: 20,
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 16,
            alignItems: "flex-start",
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={groupLabelStyle}>地域</div>
            <div style={controlBoxStyle}>
              <select
                value={selectedRegion}
                onChange={(e) => setSelectedRegion(e.target.value)}
                style={selectInnerStyle}
              >
                {CHART_REGIONS.map((region) => (
                  <option key={region} value={region}>
                    {region}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div style={groupLabelStyle}>年</div>
            <div style={controlBoxStyle}>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                style={selectInnerStyle}
              >
                {availableYears.map((year) => (
                  <option key={year} value={year}>
                    {year}年
                  </option>
                ))}
              </select>
            </div>
          </div>

          {activeChart === "pie" && (
            <div>
              <div style={groupLabelStyle}>月</div>
              <div style={controlBoxStyle}>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  style={selectInnerStyle}
                >
                  {MONTHS.map((month) => (
                    <option key={month} value={month}>
                      {month}月
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
          <div>
            <div style={groupLabelStyle}>グラフ情報</div>
            <div style={controlBoxStyle}>
              <button
                onClick={handleExportPdf}
                disabled={isExporting}
                style={{
                  ...styles.primaryButton,
                  padding: "6px 12px",
                  fontSize: "0.8rem",
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
                  padding: "6px 12px",
                  fontSize: "0.8rem",
                  opacity: isExporting ? 0.6 : 1,
                  cursor: isExporting ? "not-allowed" : "pointer",
                }}
              >
                Excelで書き出し
              </button>
            </div>
          </div>

          <div>
            <div style={groupLabelStyle}>データベース情報</div>
            <div style={controlBoxStyle}>
              <button
                onClick={handleExportCsv}
                disabled={isExporting}
                style={{
                  padding: "6px 12px",
                  backgroundColor: "#4a5568",
                  color: "#fff",
                  border: "none",
                  borderRadius: 6,
                  fontWeight: "bold",
                  fontSize: "0.8rem",
                  opacity: isExporting ? 0.6 : 1,
                  cursor: isExporting ? "not-allowed" : "pointer",
                }}
              >
                CSVで書き出し
              </button>
            </div>
          </div>

          {autoSupported && (
            <div>
              <div style={groupLabelStyle}>自動書き出し設定(毎月・前月分CSV)</div>
              <div style={{ ...controlBoxStyle, flexWrap: "wrap" }}>
                <button
                  onClick={handleChooseAutoFolder}
                  style={{
                    padding: "6px 12px",
                    backgroundColor: "#fff",
                    color: "#4a5568",
                    border: "1px solid #cbd5e0",
                    borderRadius: 6,
                    fontWeight: "bold",
                    fontSize: "0.8rem",
                    cursor: "pointer",
                  }}
                >
                  {autoFolderName ? "フォルダを変更" : "保存先フォルダを設定"}
                </button>
                {autoFolderName && (
                  <button
                    onClick={handleClearAutoFolder}
                    style={{
                      padding: "6px 12px",
                      backgroundColor: "#fff",
                      color: "#e53e3e",
                      border: "1px solid #fc8181",
                      borderRadius: 6,
                      fontWeight: "bold",
                      fontSize: "0.8rem",
                      cursor: "pointer",
                    }}
                  >
                    解除
                  </button>
                )}
                <span style={{ fontSize: "0.78rem", color: "#4a5568" }}>
                  {autoFolderName ? `保存先: ${autoFolderName}` : "未設定"}
                </span>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: "0.78rem",
                    fontWeight: "bold",
                    color: "#4a5568",
                    cursor: autoFolderName ? "pointer" : "not-allowed",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={autoEnabled}
                    disabled={!autoFolderName}
                    onChange={(e) => handleToggleAutoEnabled(e.target.checked)}
                  />
                  前月分を自動保存する
                </label>
                {autoNeedsReauth && (
                  <button
                    onClick={handleReauthorizeFolder}
                    style={{
                      padding: "6px 12px",
                      backgroundColor: "#dd6b20",
                      color: "#fff",
                      border: "none",
                      borderRadius: 6,
                      fontWeight: "bold",
                      fontSize: "0.8rem",
                      cursor: "pointer",
                    }}
                  >
                    フォルダを再許可
                  </button>
                )}
              </div>
              {autoNotice && (
                <div style={{ fontSize: "0.72rem", color: "#718096", marginTop: 4, maxWidth: 260 }}>
                  {autoNotice}
                </div>
              )}
            </div>
          )}
        </div>
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
          {activeChart === "pie" && pieTotal === 0 ? (
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
            <ResponsiveContainer>
              {activeChart === "pie" ? (
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    outerRadius={110}
                    label={(entry) =>
                      entry.value > 0 ? `${entry.label}: ${entry.value}` : ""
                    }
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
              ) : (
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tickFormatter={(m) => `${m}月`} />
                  <YAxis
                    allowDecimals={false}
                    width={50}
                    label={{ value: "件数", angle: -90, position: "insideLeft" }}
                  />
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
          )}
        </div>

        <table
          style={{
            width: "100%",
            marginTop: 20,
            borderCollapse: "collapse",
            tableLayout: "fixed",
            fontSize: "0.85rem",
          }}
        >
          <thead>
            <tr>
              {(activeChart === "pie"
                ? ["カテゴリ", "件数"]
                : ["月", "業務系", "インフラ", "組み込み", "その他", "合計"]
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
    </div>
  );
}
