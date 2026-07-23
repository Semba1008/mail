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

// 案件情報グラフ画面 (/stats) の本体コンポーネント。
// 円グラフ(月別内訳)・棒グラフ(年間推移)の切り替え表示、
// 地域/年/月による絞り込み、PDF・Excel・CSVへの書き出し、
// および自動書き出し(前月分CSVを毎月フォルダへ保存)の設定UIを提供する。
// 集計ロジック自体は utils/projectStats.js に切り出してあり、本ファイルは
// その結果を状態管理・グラフ描画・書き出し処理に繋ぐ役割を担う。

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

  // どちらのグラフを表示中か("pie"=月別内訳の円グラフ, "bar"=年間推移の棒グラフ)
  const [activeChart, setActiveChart] = useState("pie");
  const [selectedRegion, setSelectedRegion] = useState("すべて");
  // 円グラフの対象月。初期値は当月
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  // PDF/Excel/CSV書き出し中はボタンを無効化するためのフラグ
  const [isExporting, setIsExporting] = useState(false);

  // 自動書き出し(前月分CSVをフォルダへ自動保存する)機能に関する状態。
  // File System Access API 非対応ブラウザでは autoSupported が false のままとなり、
  // 設定UI自体を表示しない。
  const [autoSupported, setAutoSupported] = useState(false);
  const [autoEnabled, setAutoEnabled] = useState(false);
  const [autoFolderName, setAutoFolderName] = useState("");
  // フォルダへの書き込み権限が失効した場合に再許可ボタンを表示するためのフラグ
  const [autoNeedsReauth, setAutoNeedsReauth] = useState(false);
  const [autoNotice, setAutoNotice] = useState("");

  // 地域絞り込み後の案件一覧。年/月の選択肢や各グラフのデータ元になる
  const regionFilteredProjects = useMemo(
    () => filterProjectsByRegion(projects, selectedRegion),
    [projects, selectedRegion],
  );

  // 地域絞り込み後のデータに実際に存在する年の一覧(降順)。
  // 年セレクトボックスの選択肢として使う
  const availableYears = useMemo(
    () => getAvailableYears(regionFilteredProjects),
    [regionFilteredProjects],
  );

  // 選択中の年。当年のデータがあれば当年、なければ最新の年をデフォルトにする
  const [selectedYear, setSelectedYear] = useState(
    availableYears.includes(now.getFullYear())
      ? now.getFullYear()
      : availableYears[0],
  );

  // 地域を切り替えて選択中の年のデータが無くなった場合、
  // 存在する年(先頭=最新)に選択を合わせ直す
  useEffect(() => {
    if (!availableYears.includes(selectedYear)) {
      setSelectedYear(availableYears[0]);
    }
  }, [availableYears, selectedYear]);

  // PDF/Excel書き出し時にグラフ領域をhtml2canvasで画像化するための参照
  const chartRef = useRef(null);

  // useAutoExportWatcher からの結果通知を受け取り、画面表示用の状態に反映する。
  // 権限失効時は再許可ボタンを出し、成功時はブラウザ通知(許可済みの場合)も出す
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

  // 前月分CSVの自動書き出しを定期的にチェックするフック(実処理はフック側に委譲)
  const { runCheckNow } = useAutoExportWatcher(projects, {
    onResult: handleAutoExportResult,
  });

  // 初回マウント時、ブラウザが自動書き出し機能(File System Access API)に
  // 対応しているか判定し、対応していれば設定UIを表示。
  // 以前選択した保存先フォルダのハンドルが残っていれば、その名前を復元表示する
  useEffect(() => {
    if (!isAutoExportSupported()) return;
    setAutoSupported(true);
    setAutoEnabled(getAutoExportEnabled());

    (async () => {
      const handle = await loadDirectoryHandle().catch(() => null);
      if (handle) setAutoFolderName(handle.name);
    })();
  }, []);

  // 保存先フォルダをユーザーに選択させ、ハンドルをIndexedDB等に永続化する。
  // ユーザーがピッカーをキャンセルした場合(AbortError)はエラー扱いにしない
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

  // 保存先フォルダの設定を解除し、自動書き出しも合わせて無効化する
  const handleClearAutoFolder = async () => {
    await clearDirectoryHandle().catch(() => {});
    setAutoFolderName("");
    setAutoNeedsReauth(false);
    setAutoEnabled(false);
    setAutoExportEnabled(false);
    setAutoNotice("保存先フォルダの設定を解除しました。");
  };

  // 「前月分を自動保存する」チェックボックスの切り替え。
  // 有効化時、通知許可が未設定(default)ならブラウザ通知の許可を求め、
  // 直後に一度チェックを走らせて取りこぼしを防ぐ
  const handleToggleAutoEnabled = async (checked) => {
    setAutoEnabled(checked);
    setAutoExportEnabled(checked);
    if (checked && typeof Notification !== "undefined" && Notification.permission === "default") {
      await Notification.requestPermission().catch(() => {});
    }
    if (checked) await runCheckNow();
  };

  // フォルダへの書き込み権限が失効した際、再度許可を求めてから
  // 自動書き出しチェックを再実行する
  const handleReauthorizeFolder = async () => {
    const handle = await loadDirectoryHandle().catch(() => null);
    if (!handle) return;
    const granted = await requestDirectoryPermission(handle).catch(() => false);
    if (granted) {
      setAutoNeedsReauth(false);
      await runCheckNow();
    }
  };

  // 円グラフ用データ: 選択年月におけるカテゴリ別件数(dev/infra/embedded/other)
  const pieData = useMemo(
    () =>
      getMonthlyCategoryBreakdown(
        regionFilteredProjects,
        selectedYear,
        selectedMonth,
      ),
    [regionFilteredProjects, selectedYear, selectedMonth],
  );
  // 棒グラフ用データ: 選択年における月別×カテゴリ別件数(スタック棒グラフの元データ)
  const barData = useMemo(
    () => getYearlyMonthlyCounts(regionFilteredProjects, selectedYear),
    [regionFilteredProjects, selectedYear],
  );

  // 円グラフの合計件数。0件なら「該当期間のデータがありません」表示に切り替える判定に使う
  const pieTotal = pieData.reduce((sum, entry) => sum + entry.value, 0);

  // CSV書き出し対象の生案件データ。円グラフ表示中は年月一致、
  // 棒グラフ表示中は年のみ一致するものを抽出する(表示中のグラフに対応する期間分を書き出す)
  const csvProjects = useMemo(
    () =>
      activeChart === "pie"
        ? filterProjectsByPeriod(regionFilteredProjects, selectedYear, selectedMonth)
        : filterProjectsByPeriod(regionFilteredProjects, selectedYear),
    [regionFilteredProjects, activeChart, selectedYear, selectedMonth],
  );

  // 書き出しファイル名に使うラベル。地域を絞り込んでいる場合はサフィックスを付与する
  const regionSuffix = selectedRegion !== "すべて" ? `_${selectedRegion}` : "";
  const fileLabel =
    (activeChart === "pie"
      ? `${selectedYear}年${selectedMonth}月_月別内訳`
      : `${selectedYear}年_年間推移`) + regionSuffix;

  // グラフ領域をPDFに書き出す。html2canvasでグラフ部分を画像化し、
  // その画像とデータの内訳(テキスト)をjsPDFで1枚のPDFにまとめる。
  // ライブラリが重いため動的importにして初期バンドルサイズを抑えている
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

      // グラフ画像の下に、表示中のグラフ種別に応じた内訳テキストを追記する
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

  // 現在の絞り込み条件(地域・年・月)に該当する生の案件データをCSVで書き出す
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

  // グラフ領域をExcelに書き出す。PDF同様html2canvasで画像化し、
  // シート上部にタイトル、中段にデータ表、右側(棒グラフは列を広めに確保)に
  // グラフ画像を貼り付ける。ExcelJSも重いため動的importにしている
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
      // 棒グラフは表の列数が多い(月/業務系/インフラ/組み込み/その他/合計)ため、
      // 表と重ならないよう画像の貼り付け開始列を後ろにずらす
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

      {/* グラフ切り替えタブ(円グラフ/棒グラフ) */}
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

          {/* 月セレクトは円グラフ表示中のみ必要なため、棒グラフ表示中は非表示にする */}
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

          {/* 自動書き出し設定UI。ブラウザがFile System Access APIに対応している場合のみ表示 */}
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
          {/* 円グラフ表示時、選択年月に該当するデータが1件も無い場合は
              空のグラフを描画せず、代わりにメッセージを表示する */}
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
                // 月別内訳の円グラフ。カテゴリごとに色分けし、件数0のセグメントは
                // ラベルを空文字にして表示を省く
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
                // 年間推移の積み上げ棒グラフ。CHART_CATEGORY_ORDER の順に
                // 同じstackId("category")を持つBarを並べることで、
                // 月ごとにカテゴリ別件数を積み上げ表示する
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

        {/* グラフと同じデータをテーブルでも表示し、数値を読み取りやすくする
            (見出し・行ともグラフ種別によって内容を切り替える) */}
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
