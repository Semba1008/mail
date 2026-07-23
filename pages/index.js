import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import parse from "html-react-parser";

import { ProjectCard } from "../components/ProjectCard";
import { Pagination } from "../components/Pagination";
import { styles } from "../styles/index.styles";
import { regionalPrefectures } from "../constants/regions";
import { skillCategories } from "../constants/skills";
import { sideCategories, tabs } from "../constants/tabs";
import { PAGE_SIZE } from "../constants/config";
import { storage } from "../utils/storage";
import { formatContent } from "../utils/format";
import { getProjectCategories } from "../utils/project";
import { useAutoExportWatcher } from "../utils/useAutoExportWatcher";

// 案件が「まもなく募集終了(登録から335〜365日)」かどうかを判定する
function computeIsExpiringSoon(createdAt) {
  if (!createdAt) return false;
  const expireDate = new Date(createdAt);
  expireDate.setDate(expireDate.getDate() + 365);
  const warningDate = new Date(expireDate);
  warningDate.setDate(warningDate.getDate() - 30);
  const now = new Date();
  return now >= warningDate && now <= expireDate;
}

// メインコンポーネント
export default function Home() {
  const [authChecked, setAuthChecked] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPrefs, setSelectedPrefs] = useState([]);
  const [selectedSkills, setSelectedSkills] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [stationSuggestions, setStationSuggestions] = useState([]);
  const [isRemoteOnly, setIsRemoteOnly] = useState(false);
  const [hideClosed, setHideClosed] = useState(true);
  const [viewMode, setViewMode] = useState("all");
  const [favFilters, setFavFilters] = useState([]);
  const [historyIds, setHistoryIds] = useState([]);
  const [readIds, setReadIds] = useState([]);
  const [appliedIds, setAppliedIds] = useState([]);
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [selectedRegion, setSelectedRegion] = useState("すべて");
  const [isLoaded, setIsLoaded] = useState(false);
  const [autoExportNotice, setAutoExportNotice] = useState("");
  const [total, setTotal] = useState(0);
  const [favoriteIds, setFavoriteIds] = useState([]);
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [exportProjects, setExportProjects] = useState([]);
  const fetchRequestIdRef = useRef(0);

  // 統計グラフ画面(/stats)で設定した「前月分CSVの自動書き出し」を、
  // このメイン画面を開いたときにも判定・実行する(取りこぼしを減らすため)。
  // 一覧は現在ページ(24件)しか保持していないため、書き出し対象(前月分)は別途軽量取得する。
  useAutoExportWatcher(exportProjects, {
    onResult: (result) => {
      if (result.type === "needs-reauth") return;
      setAutoExportNotice(result.message);
      if (
        result.type === "success" &&
        typeof Notification !== "undefined" &&
        Notification.permission === "granted"
      ) {
        new Notification("案件データの自動書き出し", { body: result.message });
      }
    },
  });

  useEffect(() => {
    setIsLoaded(false); // プロジェクトが選択されるたびにリセット
    const timer = setTimeout(() => setIsLoaded(true), 150);
    return () => clearTimeout(timer);
  }, [selectedProject]);

  // キーワード検索はサーバーへの問い合わせが必要なので、入力が止まってから検索する
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    const checkLogin = async () => {
      try {
        const res = await fetch("/api/me", {
          credentials: "include",
        });

        if (!res.ok) {
          window.location.href = "/login";
          return;
        }

        const data = await res.json();
        setUser(data);
        setAuthChecked(true);
        setFavoriteIds(storage.get("favorites"));
        setHistoryIds(storage.get("history"));
        setReadIds(storage.get("readProjects"));
        setAppliedIds(storage.get("appliedIds"));
      } catch {
        window.location.href = "/login";
      }
    };

    checkLogin();
  }, []);

  // 前月分CSV自動書き出し用のデータ(content等は含めない軽量取得)。
  // 月をまたいだ場合に取りこぼさないよう、30分おきに再取得する。
  useEffect(() => {
    if (!authChecked || !user) return;

    const loadExportProjects = async () => {
      const now = new Date();
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      try {
        const res = await fetch(
          `/api/mails?mode=export&year=${prev.getFullYear()}&month=${prev.getMonth() + 1}`,
        );
        const payload = await res.json();
        if (!payload.error && payload.data) setExportProjects(payload.data);
      } catch (error) {
        console.error("自動書き出し用データ取得エラー:", error);
      }
    };

    loadExportProjects();
    const interval = setInterval(loadExportProjects, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [authChecked, user]);

  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch("/api/logout", {
        method: "POST",
        credentials: "include",
      });

      router.push("/login");
    } catch (error) {
      console.error(error);
      alert("ログアウトに失敗しました");
    }
  };

  // 🕒 検索履歴用のStateと保存関数（内部的な保存枠は20件）
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [history, setHistory] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        return JSON.parse(localStorage.getItem("searchHistory") || "[]");
      } catch {
        return [];
      }
    }
    return [];
  });
  // 検索キーワードを履歴に保存する関数。重複は削除して最新のものを先頭に、最大20件まで保持します
  const handleSearchSubmit = (keyword) => {
    if (!keyword || !keyword.trim()) return;
    const trimmed = keyword.trim();
    setHistory((prev) => {
      // 🟢 履歴データ自体は20件まで保持し、表示側で高さを制限してスクロールさせます
      const next = [trimmed, ...prev.filter((k) => k !== trimmed)].slice(0, 20);
      if (typeof window !== "undefined") {
        localStorage.setItem("searchHistory", JSON.stringify(next));
      }
      return next;
    });
  };

  // supabaseから添付ファイル情報を取得して、 機械語（バイナリデータ）をファイルに復元してダウンロードする
  const handleDownloadFile = async (event, fileUrl, fileName) => {
    event.preventDefault();
    event.stopPropagation();

    if (!fileUrl) {
      alert("ファイルURLが存在しません。");
      return;
    }

    try {
      const safeUrl = encodeURI(decodeURI(fileUrl));
      const response = await fetch(safeUrl);
      if (!response.ok) {
        throw new Error(
          `ファイルの取得に失敗しました (Status: ${response.status})`,
        );
      }

      const blob = await response.blob();
      const tempUrl = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = tempUrl;
      link.download = fileName || "download_file";
      document.body.appendChild(link);
      link.click();

      document.body.removeChild(link);
      window.URL.revokeObjectURL(tempUrl);
    } catch (error) {
      console.error("ダウンロードエラー:", error);
      window.open(encodeURI(decodeURI(fileUrl)), "_blank");
    }
  };

  // 現在の検索・絞込・ページ条件でAPIから1ページ分だけ取得する
  const fetchPage = useCallback(async () => {
    const requestId = ++fetchRequestIdRef.current;
    setLoading(true);

    try {
      const params = new URLSearchParams();
      params.set("mode", "list");
      params.set("page", String(currentPage));
      params.set("pageSize", String(PAGE_SIZE));
      if (debouncedQuery) params.set("q", debouncedQuery);
      if (viewMode === "all" && selectedRegion !== "すべて") {
        params.set("region", selectedRegion);
      }
      selectedPrefs.forEach((pref) => params.append("prefs", pref));
      selectedSkills.forEach((skill) => params.append("skills", skill));
      favFilters.forEach((cat) => params.append("categories", cat));
      if (isRemoteOnly) params.set("remote", "1");
      params.set("hideClosed", hideClosed ? "1" : "0");
      params.set("viewMode", viewMode);
      appliedIds.forEach((id) => params.append("appliedIds", String(id)));
      if (viewMode === "favorites") {
        favoriteIds.forEach((id) => params.append("ids", String(id)));
      } else if (viewMode === "history") {
        historyIds.forEach((id) => params.append("ids", String(id)));
      }

      const res = await fetch(`/api/mails?${params.toString()}`);
      const payload = await res.json();

      if (requestId !== fetchRequestIdRef.current) return; // 古いレスポンスは無視

      if (payload.error || !payload.data) {
        setProjects([]);
        setTotal(0);
        return;
      }

      setProjects(
        payload.data.map((item) => ({
          ...item,
          favorite: favoriteIds.includes(item.id),
          isExpiringSoon: computeIsExpiringSoon(item.created_at),
        })),
      );
      setTotal(payload.total || 0);
    } catch (error) {
      if (requestId === fetchRequestIdRef.current) {
        console.error("データ取得エラー:", error);
      }
    } finally {
      if (requestId === fetchRequestIdRef.current) setLoading(false);
    }
  }, [
    currentPage,
    debouncedQuery,
    viewMode,
    selectedRegion,
    selectedPrefs,
    selectedSkills,
    favFilters,
    isRemoteOnly,
    hideClosed,
    appliedIds,
    favoriteIds,
    historyIds,
  ]);

  useEffect(() => {
    if (!authChecked || !user) return;
    fetchPage();
  }, [authChecked, user, fetchPage]);

  // 駅名サジェスト取得
  const fetchStations = useCallback(
    async (keyword) => {
      if (!keyword) {
        setStationSuggestions([]);
        return;
      }
      try {
        const targetPrefs = selectedPrefs.length ? selectedPrefs : ["大阪府"];
        const responses = await Promise.all(
          targetPrefs.slice(0, 5).map((pref) =>
            fetch(
              `https://express.heartrails.com/api/json?method=getStations&prefecture=${encodeURIComponent(pref)}`,
            )
              .then((res) => res.json())
              .catch(() => ({ response: { station: [] } })),
          ),
        );
        const stations = responses.flatMap(
          (json) =>
            json?.response?.station?.map((station) => station.name) || [],
        );
        setStationSuggestions(
          [...new Set(stations.filter((name) => name.includes(keyword)))].slice(
            0,
            10,
          ),
        );
      } catch {
        setStationSuggestions([]);
      }
    },
    [selectedPrefs],
  );

  // 検索・絞込・ページングはサーバー側(/api/mails?mode=list)で行うため、
  // ここでは取得済みの現在ページ分をそのまま表示する
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentItems = projects;

  // ページネーション範囲計算
  const paginationRange = useMemo(() => {
    const siblingCount = 2;
    const totalPageNumbers = siblingCount * 2 + 5;
    if (totalPageNumbers >= totalPages)
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    const leftSiblingIndex = Math.max(currentPage - siblingCount, 1);
    const rightSiblingIndex = Math.min(currentPage + siblingCount, totalPages);
    const shouldShowLeftDots = leftSiblingIndex > 2;
    const shouldShowRightDots = rightSiblingIndex < totalPages - 2;
    if (!shouldShowLeftDots && shouldShowRightDots) {
      return Array.from({ length: 3 + 2 * siblingCount }, (_, i) => i + 1);
    }
    if (shouldShowLeftDots && !shouldShowRightDots) {
      const rightItemCount = 3 + 2 * siblingCount;
      return Array.from(
        { length: rightItemCount },
        (_, i) => totalPages - rightItemCount + i + 1,
      );
    }
    if (shouldShowLeftDots && shouldShowRightDots) {
      return Array.from(
        { length: rightSiblingIndex - leftSiblingIndex + 1 },
        (_, i) => leftSiblingIndex + i,
      );
    }
    return [];
  }, [currentPage, totalPages]);
  const changePage = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  const toggleSelection = (item, selected, setter) => {
    setter(
      selected.includes(item)
        ? selected.filter((value) => value !== item)
        : [...selected, item],
    );

    setCurrentPage(1);
  };

  useEffect(() => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }, [currentPage]);

  const toggleFavorite = (event, id) => {
    event.stopPropagation();
    setFavoriteIds((prev) => {
      const updated = prev.includes(id)
        ? prev.filter((favId) => favId !== id)
        : [...prev, id];
      storage.set("favorites", updated);
      return updated;
    });
    // 再取得を待たずに星マークだけ即時反映する
    setProjects((prev) =>
      prev.map((p) => (p.id === id ? { ...p, favorite: !p.favorite } : p)),
    );
  };

  const toggleApplied = (event, id) => {
    event.preventDefault();
    event.stopPropagation();
    const updated = appliedIds.includes(id)
      ? appliedIds.filter((itemId) => itemId !== id)
      : [...appliedIds, id];
    setAppliedIds(updated);
    storage.set("appliedIds", updated);
  };

  const openProject = (project) => {
    setSelectedProject(project);
    const historyData = storage.get("history");
    if (!historyData.includes(project.id)) {
      const updated = [project.id, ...historyData].slice(0, 50);
      storage.set("history", updated);
      setHistoryIds(updated);
    }
    const reads = storage.get("readProjects");
    if (!reads.includes(project.id)) {
      const updated = [...reads, project.id];
      storage.set("readProjects", updated);
      setReadIds(updated);
    }
  };

  const handleSendEmail = (event, project) => {
    event.preventDefault();
    event.stopPropagation();
    const targetEmail =
      project.content?.match(/[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}/)?.[0] || "";
    const ccEmail = project.cc_address || "";
    window.location.href = ccEmail
      ? `mailto:${targetEmail}?cc=${encodeURIComponent(ccEmail)}`
      : `mailto:${targetEmail}`;
  };

  const handleExecuteDelete = async () => {
    if (!deleteTargetId) return;
    try {
      const res = await fetch(
        `/api/mails?id=${encodeURIComponent(deleteTargetId)}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        alert("削除に失敗しました。サーバーエラーの可能性があります。");
        return;
      }
      setSelectedProject((prev) =>
        prev?.projects_id === deleteTargetId ? null : prev,
      );
      // ページ内の件数・総件数がズレないよう、現在の条件で取り直す
      await fetchPage();
    } catch (error) {
      console.error("削除リクエスト中にエラーが発生しました:", error);
    } finally {
      setDeleteTargetId(null);
    }
  };

  const filterablePrefectures = useMemo(() => {
    if (selectedRegion === "すべて") {
      return regionalPrefectures.flatMap((r) => r.prefs);
    }
    return (
      regionalPrefectures.find((r) => r.region === selectedRegion)?.prefs || []
    );
  }, [selectedRegion]);

  if (!authChecked) {
    return <div>認証チェック中...</div>;
  }

  if (!user) {
    return <div>ログインが必要です</div>;
  }

  return (
    <div style={styles.page}>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      {autoExportNotice && (
        <div
          style={{
            position: "fixed",
            right: 20,
            bottom: 20,
            zIndex: 2000,
            maxWidth: 320,
            background: "#1a365d",
            color: "#fff",
            padding: "12px 16px",
            borderRadius: 8,
            fontSize: "0.85rem",
            boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
          }}
        >
          <span style={{ flex: 1 }}>{autoExportNotice}</span>
          <button
            onClick={() => setAutoExportNotice("")}
            style={{
              background: "none",
              border: "none",
              color: "#cbd5e0",
              cursor: "pointer",
              fontSize: "1rem",
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
      )}
      <nav style={styles.nav}>
        <div style={{ ...styles.navInner, justifyContent: "space-between" }}>
          <div
            style={{ display: "flex", height: "100%", alignItems: "center" }}
          >
            <div
              style={{
                marginRight: 30,
                height: 35,
                display: "flex",
                alignItems: "center",
              }}
            >
              <img
                src="/Logo_Mark2.png"
                alt="GE CREATIVE"
                style={{ height: "100%", width: "auto", objectFit: "contain" }}
              />
            </div>
            <div style={{ display: "flex", height: "100%" }}>
              {tabs.map((tab) => {
                const isActive = viewMode === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setViewMode(tab.id);
                      setCurrentPage(1);
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      color: isActive ? "#00bfa5" : "#4a5568",
                      cursor: "pointer",
                      fontWeight: 600,
                      padding: "0 25px",
                      height: "100%",
                      borderBottom: isActive
                        ? "3px solid #00bfa5"
                        : "3px solid transparent",
                      boxSizing: "border-box",
                    }}
                  >
                    {tab.label}
                  </button>
                );
              })}
              <button
                onClick={() => router.push("/stats")}
                style={{
                  background: "none",
                  border: "none",
                  color: "#4a5568",
                  cursor: "pointer",
                  fontWeight: 600,
                  padding: "0 25px",
                  height: "100%",
                  borderBottom: "3px solid transparent",
                  boxSizing: "border-box",
                }}
              >
                📊 グラフ
              </button>
              <button
                onClick={() => router.push("/automate-results")}
                style={{
                  background: "none",
                  border: "none",
                  color: "#4a5568",
                  cursor: "pointer",
                  fontWeight: 600,
                  padding: "0 25px",
                  height: "100%",
                  borderBottom: "3px solid transparent",
                  boxSizing: "border-box",
                }}
              >
                🤖 automateの実行結果
              </button>
            </div>
          </div>
          {viewMode === "all" && (
            <div
              style={{ display: "flex", height: "100%", alignItems: "center" }}
            >
              {["すべて", "東日本", "中日本", "西日本"].map((regionName) => {
                const isRegActive = selectedRegion === regionName;
                return (
                  <button
                    key={regionName}
                    onClick={() => {
                      setSelectedRegion(regionName);
                      setSelectedPrefs([]);
                      setCurrentPage(1);
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      color: isRegActive ? "#1a365d" : "#718096",
                      cursor: "pointer",
                      fontWeight: 700,
                      padding: "0 15px",
                      height: "100%",
                      fontSize: "0.95rem",
                      borderBottom: isRegActive
                        ? "3px solid #1a365d"
                        : "3px solid transparent",
                      boxSizing: "border-box",
                    }}
                  >
                    {regionName}
                  </button>
                );
              })}
              <button
                onClick={handleLogout}
                style={{
                  marginLeft: 20,
                  padding: "8px 16px",
                  borderRadius: 6,
                  border: "1px solid #e53e3e",
                  background: "#fff",
                  color: "#e53e3e",
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
              >
                ログアウト
              </button>
            </div>
          )}
        </div>
      </nav>
      <div
        style={{
          display: "flex",
          padding: "40px 20px",
          gap: 30,
          boxSizing: "border-box",
        }}
      >
        <aside style={styles.sidebar}>
          <h2
            style={{
              fontSize: "1rem",
              fontWeight: "bold",
              marginBottom: 15,
              color: "#1a365d",
              borderLeft: "4px solid #1a365d",
              paddingLeft: 10,
            }}
          >
            カテゴリー
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {sideCategories.map((button) => {
              const isSelected =
                button.id === "all"
                  ? !favFilters.length
                  : favFilters.includes(button.id);
              return (
                <button
                  key={button.id}
                  onClick={() => {
                    setFavFilters(
                      button.id === "all"
                        ? []
                        : favFilters.includes(button.id)
                          ? favFilters.filter((id) => id !== button.id)
                          : [...favFilters, button.id],
                    );
                    setCurrentPage(1);
                  }}
                  style={{
                    padding: "12px 15px",
                    borderRadius: 8,
                    textAlign: "left",
                    border: "1px solid",
                    borderColor: isSelected ? "#00bfa5" : "#cbd5e0",
                    backgroundColor: isSelected ? "#00bfa5" : "#fff",
                    color: isSelected ? "#fff" : "#4a5568",
                    cursor: "pointer",
                    fontSize: "0.95rem",
                    fontWeight: "bold",
                  }}
                >
                  {button.label}
                </button>
              );
            })}
          </div>
        </aside>
        <main style={{ flexGrow: 1, maxWidth: 1600 }}>
          {viewMode === "all" && (
            <div
              style={{
                backgroundColor: "#fff",
                padding: 25,
                borderRadius: 10,
                border: "1px solid #e2e8f0",
                marginBottom: 30,
              }}
            >
              <div style={{ position: "relative", marginBottom: 15 }}>
                <input
                  type="text"
                  placeholder="キーワード・駅名で検索"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                    fetchStations(e.target.value);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() =>
                    setTimeout(() => setShowSuggestions(false), 200)
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleSearchSubmit(searchQuery);
                    }
                  }}
                  style={{
                    width: "100%",
                    padding: 14,
                    border: "2px solid #cbd5e0",
                    borderRadius: 8,
                    fontSize: "1rem",
                    boxSizing: "border-box",
                  }}
                />

                {showSuggestions && history.length > 0 && (
                  /* 🟢 max-heightを履歴5件分相当の「220px」に固定し、あふれたらスクロール（overflowY: "auto"）にした */
                  <div
                    style={{
                      position: "absolute",
                      top: "100%",
                      left: 0,
                      right: 0,
                      backgroundColor: "#fff",
                      border: "1px solid #cbd5e0",
                      zIndex: 110,
                      borderRadius: 8,
                      boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
                      marginTop: 4,
                      maxHeight: "220px",
                      overflowY: "auto",
                    }}
                  >
                    <div
                      style={{
                        padding: "8px 12px",
                        fontSize: "0.75rem",
                        fontWeight: "bold",
                        color: "#a0aec0",
                        borderBottom: "1px solid #edf2f7",
                        position: "sticky",
                        top: 0,
                        backgroundColor: "#fff",
                        zIndex: 1,
                      }}
                    >
                      過去の検索履歴
                    </div>
                    {history.map((name) => (
                      <div
                        key={name}
                        onMouseDown={() => {
                          setSearchQuery(name);
                          handleSearchSubmit(name);
                          setCurrentPage(1);
                        }}
                        style={{
                          padding: 12,
                          cursor: "pointer",
                          borderBottom: "1px solid #f7fafc",
                          fontSize: "0.9rem",
                          color: "#4a5568",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        🕒 {name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <button
                  onClick={() => setShowFilters((v) => !v)}
                  style={{
                    background: "#f8fafc",
                    border: "1px solid #cbd5e0",
                    borderRadius: 6,
                    padding: "8px 16px",
                    cursor: "pointer",
                    fontSize: "0.85rem",
                    fontWeight: "bold",
                  }}
                >
                  詳細絞り込み {showFilters ? "▲" : "▼"}
                </button>
                <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
                  <label
                    style={{
                      fontSize: "0.85rem",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={hideClosed}
                      onChange={(e) => {
                        setHideClosed(e.target.checked);
                        setCurrentPage(1);
                      }}
                    />
                    募集停止を非表示
                  </label>
                  <label
                    style={{
                      fontSize: "0.85rem",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isRemoteOnly}
                      onChange={(e) => {
                        setIsRemoteOnly(e.target.checked);
                        setCurrentPage(1);
                      }}
                    />
                    リモート案件
                  </label>
                </div>
              </div>
              {showFilters && (
                <div
                  style={{
                    marginTop: 20,
                    borderTop: "1px solid #edf2f7",
                    paddingTop: 20,
                  }}
                >
                  <div style={{ marginBottom: 20 }}>
                    <div
                      style={{
                        marginBottom: 10,
                        fontSize: "0.8rem",
                        fontWeight: "bold",
                        color: "#4a5568",
                      }}
                    >
                      都道府県
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {filterablePrefectures.map((pref) => (
                        <button
                          key={pref}
                          onClick={() =>
                            toggleSelection(
                              pref,
                              selectedPrefs,
                              setSelectedPrefs,
                            )
                          }
                          style={{
                            padding: "6px 12px",
                            borderRadius: 6,
                            border: "1px solid",
                            borderColor: selectedPrefs.includes(pref)
                              ? "#00bfa5"
                              : "#e2e8f0",
                            backgroundColor: selectedPrefs.includes(pref)
                              ? "#00bfa5"
                              : "#fff",
                            color: selectedPrefs.includes(pref)
                              ? "#fff"
                              : "#4a5568",
                            fontSize: "0.75rem",
                            cursor: "pointer",
                          }}
                        >
                          {pref}
                        </button>
                      ))}
                    </div>
                  </div>
                  {skillCategories.map((category) => (
                    <div key={category.label} style={{ marginBottom: 10 }}>
                      <div
                        style={{
                          marginBottom: 10,
                          fontSize: "0.8rem",
                          fontWeight: "bold",
                          color: "#4a5568",
                        }}
                      >
                        {category.label}
                      </div>
                      <div
                        style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
                      >
                        {category.skills.map((skill) => (
                          <button
                            key={skill}
                            onClick={() =>
                              toggleSelection(
                                skill,
                                selectedSkills,
                                setSelectedSkills,
                              )
                            }
                            style={{
                              padding: "6px 12px",
                              borderRadius: 6,
                              border: "1px solid",
                              borderColor: selectedSkills.includes(skill)
                                ? "#3182ce"
                                : "#e2e8f0",
                              backgroundColor: selectedSkills.includes(skill)
                                ? "#3182ce"
                                : "#fff",
                              color: selectedSkills.includes(skill)
                                ? "#fff"
                                : "#4a5568",
                              fontSize: "0.75rem",
                              cursor: "pointer",
                            }}
                          >
                            {skill}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            paginationRange={paginationRange}
            changePage={changePage}
            style={{ marginTop: 0, marginBottom: 40 }}
          />
          <div
            style={{
              marginBottom: 15,
              fontSize: "0.9rem",
              color: "#4a5568",
              fontWeight: "bold",
            }}
          >
            該当案件数: {total} 件
          </div>
          {loading ? (
            <div style={styles.spinner} />
          ) : currentItems.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "40px",
                color: "#718096",
                backgroundColor: "#fff",
                borderRadius: 10,
                border: "1px solid #e2e8f0",
              }}
            >
              該当する案件が見つかりませんでした。
            </div>
          ) : (
            <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                  gap: 20,
                  marginBottom: 40,
                }}
              >
                {currentItems.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    readIds={readIds}
                    appliedIds={appliedIds}
                    viewMode={viewMode}
                    toggleFavorite={toggleFavorite}
                    toggleApplied={toggleApplied}
                    openProject={openProject}
                    handleSendEmail={handleSendEmail}
                    setDeleteTargetId={setDeleteTargetId}
                  />
                ))}
              </div>
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                paginationRange={paginationRange}
                changePage={changePage}
              />
            </>
          )}
        </main>
      </div>
      {selectedProject && (
        <div
          style={styles.modalOverlay}
          onClick={() => setSelectedProject(null)}
        >
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h2
              style={{
                fontSize: "1.3rem",
                color: "#1a365d",
                marginBottom: 20,
                paddingRight: 40,
              }}
            >
              {selectedProject.title}
            </h2>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 12,
                marginBottom: 25,
                fontSize: "0.95rem",
              }}
            >
              <div>
                <strong>【場所】</strong>{" "}
                {selectedProject.location || "記載なし"}
              </div>
              <div>
                <strong>【単価】</strong> {selectedProject.price || "記載なし"}
              </div>
              <div>
                <strong>【期間】</strong> {selectedProject.period || "記載なし"}
              </div>
              <div>
                <strong>【募集期間】</strong>{" "}
                {selectedProject.end_date || "記載なし"}
              </div>
              <div>
                <strong>【スキル】</strong>{" "}
                {selectedProject.skills || "記載なし"}
              </div>
              <div>
                <strong>【カテゴリ】</strong>{" "}
                {getProjectCategories(selectedProject)
                  .map((category) => {
                    switch (category) {
                      case "dev":
                        return "業務系";
                      case "infra":
                        return "インフラ";
                      case "embedded":
                        return "組み込み";
                      case "other":
                        return "その他";
                      default:
                        return category;
                    }
                  })
                  .join(" / ")}
              </div>
              {(() => {
                const pAttachments = !selectedProject.attachments
                  ? []
                  : Array.isArray(selectedProject.attachments)
                    ? selectedProject.attachments
                    : (() => {
                        try {
                          return JSON.parse(selectedProject.attachments);
                        } catch {
                          return [];
                        }
                      })();
                if (pAttachments.length === 0) return null;
                return (
                  <div
                    style={{
                      marginTop: 5,
                      padding: "10px 14px",
                      backgroundColor: "#f7fafc",
                      borderRadius: 8,
                      border: "1px solid #edf2f7",
                    }}
                  >
                    <strong
                      style={{
                        display: "block",
                        marginBottom: 6,
                        color: "#4a5568",
                      }}
                    >
                      📎 添付ファイルダウンロード:
                    </strong>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                      {pAttachments.map((file, i) => {
                        const url =
                          typeof file === "string"
                            ? file
                            : file.file_url || file.url;
                        const name =
                          typeof file === "string"
                            ? `ファイル ${i + 1}`
                            : file.file_name || file.name;
                        return (
                          <a
                            key={i}
                            href={url}
                            style={{ ...styles.attachmentLink, margin: 0 }}
                            onClick={(e) => handleDownloadFile(e, url, name)}
                          >
                            {name}
                          </a>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
            <hr
              style={{
                border: "none",
                borderTop: "1px solid #edf2f7",
                margin: "20px 0",
              }}
            />
            <div
              style={{
                whiteSpace: "pre-wrap",
                fontSize: "0.9rem",
                lineHeight: "1.6",
                color: "#4a5568",
                padding: "10px",
                width: "100%",
              }}
            >
              {selectedProject?.content ? (
                (() => {
                  const content = selectedProject.content;
                  const isFullHtml = /<[a-z][\s\S]*>/i.test(content);

                  if (isFullHtml) {
                    return (
                      <iframe
                        key={selectedProject.id}
                        srcDoc={`
                                <html>
                                  <head>
                                    <base target="_blank">
                                    <style>
                                        body { margin: 0; padding: 0; overflow: hidden; font-family: sans-serif; }
                                        body, body * { font-family: sans-serif !important; }
                                    </style>
                                  </head>
                                  <body>${content}</body>
                                </html>
                               `}
                        title="Email Content"
                        scrolling="no" // 1. スクロールバーを非表示にする
                        onLoad={(e) => {
                          // 2. 読み込み完了後に一度だけ高さを合わせる（ガタつきを抑える）
                          const target = e.target;
                          if (
                            target.contentWindow.document.body.scrollHeight > 0
                          ) {
                            target.style.height =
                              target.contentWindow.document.body.scrollHeight +
                              "px";
                          }
                        }}
                        style={{
                          width: "100%",
                          minHeight: "300px", // 3. 最初からある程度の高さを確保しておく（ラグ感を消す）
                          border: "none",
                          backgroundColor: "white",
                          display: "block",
                        }}
                      />
                    );
                  } else {
                    return <div>{formatContent(content)}</div>;
                  }
                })()
              ) : (
                <div>データがありません</div>
              )}
            </div>
          </div>
        </div>
      )}
      {deleteTargetId && (
        <div
          style={styles.modalOverlay}
          onClick={() => setDeleteTargetId(null)}
        >
          <div
            style={{
              ...styles.modalContent,
              maxWidth: 400,
              textAlign: "center",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: "1.1rem", marginBottom: 20 }}>
              案件を削除しますか？
            </h3>
            <p
              style={{
                fontSize: "0.85rem",
                color: "#718096",
                marginBottom: 25,
              }}
            >
              削除後は修復できません。
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <button
                onClick={() => setDeleteTargetId(null)}
                style={{
                  padding: "10px 20px",
                  background: "#edf2f7",
                  border: "none",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
              >
                キャンセル
              </button>
              <button
                onClick={handleExecuteDelete}
                style={{
                  padding: "10px 20px",
                  background: "#e53e3e",
                  color: "#fff",
                  border: "none",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
              >
                削除する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
