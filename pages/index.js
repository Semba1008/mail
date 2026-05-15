import { useEffect, useState } from "react";

// HTML内のURLやメールアドレスをリンク化する関数         
const formatContent = (html) => {
  if (typeof window === "undefined") return html;
  try {
    const txt = document.createElement("textarea");
    txt.innerHTML = html;
    const decoded = txt.value;
    const urlRegex = /(https?:\/\/[^\s]+|[\w.-]+@[\w.-]+\.[a-zA-Z]{2,4})/g;
    const parts = decoded.split(urlRegex);
    // URLやメールアドレスの部分をリンク化して返す
    return parts.map((part, i) => {
      if (part?.match(/https?:\/\//)) {
        return (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#3182ce", textDecoration: "underline" }}
          >
            {part}
          </a>
        );
      } else if (part?.match(/[\w.-]+@[\w.-]+\.[a-zA-Z]{2,4}/)) {
        return (
          <a
            key={i}
            href={`mailto:${part}`}
            style={{ color: "#3182ce", textDecoration: "underline" }}
          >
            {part}
          </a>
        );
      }
      return part;
    });
  } catch (e) {
    return html;
  }
};

// メインコンポーネント
export default function Home() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPrefs, setSelectedPrefs] = useState([]);
  const [selectedSkills, setSelectedSkills] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [stationSuggestions, setStationSuggestions] = useState([]);
  const [isStationLoading, setIsStationLoading] = useState(false);
  const [isRemoteOnly, setIsRemoteOnly] = useState(false);
  const [viewMode, setViewMode] = useState("all");
  const [favFilters, setFavFilters] = useState([]);
  const [historyIds, setHistoryIds] = useState([]);
  const [readIds, setReadIds] = useState([]); // ★既読IDを管理するステート
  const [appliedIds, setAppliedIds] = useState([]); // ★応募済みIDを管理するステート
  const [deleteTargetId, setDeleteTargetId] = useState(null); // 削除確認モーダル用
// 1ページあたりの表示件数
  const projectsPerPage = 12;
 // 都道府県リスト
  const prefectures = [
    "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県",
    "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
    "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県",
    "静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府", "兵庫県",
    "奈良県", "和歌山県", "鳥取県", "島根県", "岡山県", "広島県", "山口県",
    "徳島県", "香川県", "愛媛県", "高知県", "福岡県", "佐賀県", "長崎県",
    "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県",
  ];
  // スキルカテゴリとスキルのリスト
  const skillCategories = [
    { label: "Language / Backend", skills: ["Java", "PHP", "Python", "Ruby", "Go", "C#", "C++", "Rust", "Kotlin", "Swift"] },
    { label: "Frontend", skills: ["React", "Next.js", "Vue.js", "Nuxt.js", "TypeScript", "JavaScript"] },
    { label: "Infra / OS / Cloud", skills: ["AWS", "Azure", "GCP", "Docker", "Kubernetes", "Linux", "Windows", "Terraform"] },
    { label: "DB / Tool / CI/CD", skills: ["MySQL", "PostgreSQL", "Oracle", "Git", "GitHub", "CircleCI", "Jenkins", "Ansible"] },
  ];
  // サイドのカテゴリー（お気に入りフィルタ用）
  const sideCategories = [
    { id: "all", label: "すべて" },
    { id: "dev", label: "開発" },
    { id: "infra", label: "インフラ" },
    { id: "embedded", label: "組み込み" },
  ];
  // 初回データ取得
  useEffect(() => {
    fetchData();
  }, []);
  // データ取得関数
  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/mails");
      const payload = await res.json();
      if (payload && !payload.error) {
        const savedFavorites = JSON.parse(localStorage.getItem("favorites") || "[]");
        const savedHistory = JSON.parse(localStorage.getItem("history") || "[]");
        const savedRead = JSON.parse(localStorage.getItem("readProjects") || "[]"); // ★既読データの読み込み
        const savedApplied = JSON.parse(localStorage.getItem("appliedIds") || "[]"); // ★応募済みデータの読み込み
        // ステートに保存
        setHistoryIds(savedHistory);
        setReadIds(savedRead);
        setAppliedIds(savedApplied);
        // お気に入りフラグを付与して案件データを保存
        const dataWithFavs = (payload.data || []).map((item) => ({
          ...item,
          favorite: savedFavorites.includes(item.id),
        }));
        setProjects(dataWithFavs);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setTimeout(() => setLoading(false), 500);
    }
  };

  // 削除実行
  const handleExecuteDelete = async () => {
    if (!deleteTargetId) return;
    try {
      const res = await fetch(`/api/mails?id=${deleteTargetId}`, { method: "DELETE" });
      if (res.ok) {
        setProjects(projects.filter((p) => p.id !== deleteTargetId));
        if (selectedProject?.id === deleteTargetId) setSelectedProject(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDeleteTargetId(null);
    }
  };
  // 駅名から候補を取得する関数
  const fetchStations = async (name) => {
    if (!name || name.length < 1) {
      setStationSuggestions([]);
      return;
    }

    // 駅名APIから候補を取得
    setIsStationLoading(true);
    try {
      const res = await fetch(`https://express.heartrails.com/api/json?method=getStations&name=${encodeURIComponent(name)}`);
      const json = await res.json();
      if (json?.response?.station) {
        setStationSuggestions([...new Set(json.response.station.map((s) => s.name))].slice(0, 10));
      } else {
        setStationSuggestions([]);
      }
    } catch (err) {
      setStationSuggestions([]);
    } finally {
      setIsStationLoading(false);
    }
  };
  // お気に入りの切り替え
  const toggleFavorite = (e, id) => {
    e.stopPropagation();
    const updated = projects.map((p) => (p.id === id ? { ...p, favorite: !p.favorite } : p));
    setProjects(updated);
    const favIds = updated.filter((p) => p.favorite).map((p) => p.id);
    localStorage.setItem("favorites", JSON.stringify(favIds));
  };
  // 応募済みの切り替え
  const toggleApplied = (e, id) => {
    e.preventDefault();
    e.stopPropagation();
    let updated;
    if (appliedIds.includes(id)) {
      updated = appliedIds.filter(itemId => itemId !== id);
    } else {
      updated = [...appliedIds, id];
    }
    setAppliedIds(updated);
    localStorage.setItem("appliedIds", JSON.stringify(updated));
  };

  // メール作成
  const handleSendEmail = (e, project) => {
    e.preventDefault();
    e.stopPropagation();
    const emailMatch = project.content?.match(/[\w.-]+@[\w.-]+\.[a-zA-Z]{2,4}/);
    const targetEmail = emailMatch ? emailMatch[0] : "";
    window.location.href = `mailto:${targetEmail}`;
  };

  // 案件からカテゴリを抽出する関数
  const getProjectCategories = (p) => {
    const allText = ((p.title || "") + (p.content || "") + (p.skills || "")).toLowerCase();
    let cats = [];
    if (allText.match(/java|php|python|ruby|go|c#|react|next\.js|vue\.js|typescript|javascript|フロントエンド|バックエンド|アプリ|開発/i)) cats.push("dev");
    if (allText.match(/インフラ|サーバ|ネットワーク|aws|azure|gcp|cloud|監視|構築/i)) cats.push("infra");
    if (allText.match(/組み込み|組込|マイコン|制御|c言語|c\+\+|embedded/i)) cats.push("embedded");
    return cats.length > 0 ? cats : ["dev"];
  };

  // 募集人数を抽出する関数
  const extractRecruitment = (content) => {
    if (!content) return "記載なし";
    const regex = /([0-9０-９]+|複数|若干)名(以上)?/;
    const match = content.match(regex);
    return match ? match[0] : "記載なし";
  };

  // 案件の絞り込み
  const filtered = projects.filter((p) => {
    const isApplied = appliedIds.includes(p.id);

    // ★応募済みタブ以外では、応募済み案件を非表示にする
    if (viewMode !== "applied" && isApplied) return false;
    if (viewMode === "applied") return isApplied;
    // ★お気に入りタブと履歴タブの表示条件
    if (viewMode === "favorites") return p.favorite;
    if (viewMode === "history") return historyIds.includes(p.id);
    // ★サイドのカテゴリー絞り込み 
    if (favFilters.length > 0) {
      const pCats = getProjectCategories(p);
      if (!favFilters.every((f) => pCats.includes(f))) return false;
    }
    // ★キーワード、都道府県、スキル、リモート条件の絞り込み
    const contentText = ((p.title || "") + (p.skills || "") + (p.content || "") + (p.location || "")).toLowerCase();
    const matchesSearch = contentText.includes(searchQuery.toLowerCase());
    const matchesPref = selectedPrefs.length === 0 ? true : selectedPrefs.some((pref) => p.location?.includes(pref));
    const matchesSkill = selectedSkills.length === 0 ? true : selectedSkills.every((skill) => contentText.includes(skill.toLowerCase()));
    const matchesRemote = isRemoteOnly ? p.location?.includes("リモート") || p.title?.includes("リモート") : true;
    // すべての条件を満たす案件のみ表示
    return matchesSearch && matchesPref && matchesSkill && matchesRemote;
  });
  // ページネーションのための現在表示する案件を計算
  const currentItems = filtered.slice((currentPage - 1) * projectsPerPage, currentPage * projectsPerPage);
  const totalPages = Math.ceil(filtered.length / projectsPerPage);
  // お気に入りフィルタの切り替え
  const toggleFavFilter = (id) => {
    if (id === "all") setFavFilters([]);
    else setFavFilters((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
    setCurrentPage(1);
  };
 // スキルや都道府県の選択切り替え
  const toggleSelection = (item, list, setter) => {
    if (list.includes(item)) setter(list.filter((i) => i !== item));
    else setter([...list, item]);
    setCurrentPage(1);
  };

  // 案件カードコンポーネント
  const ProjectCard = ({ project }) => {
    const isRead = readIds.includes(project.id); 
    const isApplied = appliedIds.includes(project.id);
    // 応募済みタブでは、応募済みでない案件は表示しないため、ここでのisAppliedは常にtrueになるが、念のため表示も切り替える
    return (
      <div style={{ backgroundColor: "#fff", borderRadius: "10px", padding: "25px", border: "1px solid #edf2f7", display: "flex", flexDirection: "column", position: "relative" }}>
        <div style={{ fontSize: "0.7rem", color: "#a0aec0", marginBottom: "5px" }}>ID: {project.id}</div>

        {/* 右上のアイコンエリア */}
        <div style={{ position: "absolute", top: "15px", right: "15px", display: "flex", alignItems: "center", gap: "8px" }}>
          {isApplied && viewMode !== "applied" && (
            <span style={{ fontSize: "0.7rem", backgroundColor: "#48bb78", color: "#fff", padding: "2px 6px", borderRadius: "4px", fontWeight: "bold" }}>
              応募済み
            </span>
          )}
          {isRead && (
            <span style={{ fontSize: "0.7rem", backgroundColor: "#e2e8f0", color: "#4a5568", padding: "2px 6px", borderRadius: "4px", fontWeight: "bold" }}>
              既読
            </span>
          )}
          <button 
            onClick={(e) => toggleFavorite(e, project.id)} 
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.4rem", color: project.favorite ? "#ed8936" : "#cbd5e0", padding: 0, lineHeight: 1 }}
          >
            {project.favorite ? "★" : "☆"}// お気に入りアイコン
          </button>
        </div>
          // 案件の基本情報エリア
        <h3 style={{ fontSize: "1rem", color: "#1a365d", marginBottom: "20px", fontWeight: "700", paddingRight: "60px" }}>{project.title}</h3>
        <div style={{ fontSize: "0.85rem", flexGrow: 1 }}>
          <div style={{ display: "flex", marginBottom: "8px" }}>
            <span style={{ fontWeight: "bold", minWidth: "80px" }}>【場所】</span>
            <span>{project.location || "記載なし"}</span>
          </div>
          <div style={{ display: "flex", marginBottom: "8px" }}>
            <span style={{ fontWeight: "bold", minWidth: "80px" }}>【単価】</span>
            <span>{project.price || "記載なし"}</span>
          </div>
          <div style={{ display: "flex" }}>
            <span style={{ fontWeight: "bold", minWidth: "80px" }}>【募集人数】</span>
            <span>{extractRecruitment(project.content)}</span>
          </div>
        </div>
          // 詳細・メール作成・応募切り替え・削除のボタンエリア
        <div style={{ display: "flex", gap: "8px", marginTop: "20px", flexWrap: "wrap" }}>
          <button onClick={() => {
              setSelectedProject(project);
              
              // 履歴保存
              const history = JSON.parse(localStorage.getItem("history") || "[]");
              if (!history.includes(project.id)) {
                const newHistory = [project.id, ...history].slice(0, 50);
                localStorage.setItem("history", JSON.stringify(newHistory));
                setHistoryIds(newHistory);
              }

              // ★既読保存
              const reads = JSON.parse(localStorage.getItem("readProjects") || "[]");
              if (!reads.includes(project.id)) {
                const newReads = [...reads, project.id];
                localStorage.setItem("readProjects", JSON.stringify(newReads));
                setReadIds(newReads);
              }
            }} 
            style={{ flex: "1 1 calc(50% - 4px)", padding: "10px", backgroundColor: "#1a365d", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}>
            詳細
          </button>
          <button onClick={(e) => handleSendEmail(e, project)} style={{ flex: "1 1 calc(50% - 4px)", padding: "10px", backgroundColor: "#3182ce", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}>
            メール作成
          </button>
          <button onClick={(e) => toggleApplied(e, project.id)} style={{ flex: "1 1 100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e0", background: isApplied ? "#e6fffa" : "#fff", color: isApplied ? "#38a169" : "#4a5568", cursor: "pointer", fontWeight: "bold" }}>
            {isApplied ? "応募解除" : "応募済みにする"}
          </button>
          <button onClick={(e) => { e.stopPropagation(); setDeleteTargetId(project.id); }} style={{ width: "100%", padding: "6px", borderRadius: "6px", border: "1px solid #fc8181", color: "#e53e3e", background: "#fff", cursor: "pointer", fontSize: "0.75rem" }}>
            削除
          </button>
        </div>
      </div>
    );
  };
  // メインのレンダリング
  return (
    <div style={{ backgroundColor: "#f7fafc", minHeight: "100vh", color: "#2d3748", fontFamily: "sans-serif" }}>
      <nav style={{ backgroundColor: "#1a365d", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", height: "60px", padding: "0 20px" }}>
          {[
            { id: "all", label: "案件を探す" },
            { id: "applied", label: "応募済み" },
            { id: "favorites", label: "お気に入り" },
            { id: "history", label: "閲覧履歴" },
          ].map((tab) => (     // タブ切り替えボタン
            <button
              key={tab.id}
              onClick={() => { setViewMode(tab.id); setCurrentPage(1); }}
              style={{ background: viewMode === tab.id ? "rgba(255,255,255,0.1)" : "none", border: "none", color: "#fff", cursor: "pointer", fontWeight: "600", padding: "0 25px" }}
            >
              {tab.label} // タブのラベル
            </button>
          ))}
        </div>
      </nav>

      <div style={{ display: "flex", padding: "40px 20px", gap: "30px", boxSizing: "border-box" }}>
        <aside style={{ width: "220px", flexShrink: 0 }}>
          <h2 style={{ fontSize: "1rem", fontWeight: "bold", marginBottom: "15px", color: "#1a365d", borderLeft: "4px solid #1a365d", paddingLeft: "10px" }}>カテゴリー</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {sideCategories.map((btn) => (
              <button
                key={btn.id}  // サイドのカテゴリー絞り込みボタン
                onClick={() => toggleFavFilter(btn.id)}
                style={{
                  padding: "12px 15px",
                  borderRadius: "8px",
                  textAlign: "left",
                  border: "1px solid",
                  borderColor: (btn.id === "all" ? favFilters.length === 0 : favFilters.includes(btn.id)) ? "#1a365d" : "#cbd5e0",
                  backgroundColor: (btn.id === "all" ? favFilters.length === 0 : favFilters.includes(btn.id)) ? "#1a365d" : "#fff",
                  color: (btn.id === "all" ? favFilters.length === 0 : favFilters.includes(btn.id)) ? "#fff" : "#4a5568",
                  cursor: "pointer",
                  fontSize: "0.95rem",
                  fontWeight: "bold",
                }}
              >
                {btn.label}  // ボタンのラベル
              </button>
            ))}
          </div>
        </aside>

            // メインコンテンツエリア
        <main style={{ flexGrow: 1, maxWidth: "1600px" }}>
          {viewMode === "all" && (
            <div style={{ backgroundColor: "#fff", padding: "25px", borderRadius: "10px", border: "1px solid #e2e8f0", marginBottom: "30px" }}>
              <div style={{ position: "relative", marginBottom: "15px" }}>
                <input
                  type="text"
                  placeholder="キーワード・駅名で検索"
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); fetchStations(e.target.value); }}
                  style={{ width: "100%", padding: "14px", border: "2px solid #cbd5e0", borderRadius: "8px", fontSize: "1rem", boxSizing: "border-box" }}
                />
                {stationSuggestions.length > 0 && (
                  <div style={{ position: "absolute", top: "100%", left: 0, right: 0, backgroundColor: "#fff", border: "1px solid #cbd5e0", zIndex: 100, borderRadius: "8px" }}>
                    {stationSuggestions.map((name) => (
                      <div key={name} onClick={() => { setSearchQuery(name); setStationSuggestions([]); }} style={{ padding: "12px", cursor: "pointer", borderBottom: "1px solid #f7fafc" }}>{name}駅</div>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <button onClick={() => setShowFilters(!showFilters)} style={{ background: "#f8fafc", border: "1px solid #cbd5e0", borderRadius: "6px", padding: "8px 16px", cursor: "pointer", fontSize: "0.85rem", fontWeight: "bold" }}>
                  詳細絞り込み {showFilters ? "▲" : "▼"}
                </button>
                <label style={{ fontSize: "0.85rem", cursor: "pointer", display: "flex", alignItems: "center", gap: "5px" }}>
                  <input type="checkbox" checked={isRemoteOnly} onChange={(e) => setIsRemoteOnly(e.target.checked)} /> リモートのみ
                </label>
              </div>
                // 詳細フィルタエリア（スキルと都道府県の選択）
              {showFilters && (
                <div style={{ marginTop: "20px", borderTop: "1px solid #edf2f7", paddingTop: "20px" }}>
                  {skillCategories.map((cat) => (
                    <div key={cat.label} style={{ marginBottom: "10px" }}>
                      <div style={{ marginBottom: "10px", fontSize: "0.8rem", fontWeight: "bold", color: "#4a5568" }}>{cat.label}</div>
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                        {cat.skills.map(skill => (
                          <button
                            key={skill}
                            onClick={() => toggleSelection(skill, selectedSkills, setSelectedSkills)}
                            style={{
                              padding: "6px 12px",
                              borderRadius: "6px",
                              border: "1px solid",
                              borderColor: selectedSkills.includes(skill) ? "#3182ce" : "#e2e8f0",
                              backgroundColor: selectedSkills.includes(skill) ? "#3182ce" : "#fff",
                              color: selectedSkills.includes(skill) ? "#fff" : "#4a5568",
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
                  // 都道府県選択エリア
                  <div style={{ height: "1px", backgroundColor: "#edf2f7", margin: "20px 0" }} />
               
                  <div style={{ marginBottom: "10px", fontSize: "0.8rem", fontWeight: "bold", color: "#4a5568" }}>都道府県</div>
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                    {prefectures.map(p => (
                      <button
                        key={p}
                        onClick={() => toggleSelection(p, selectedPrefs, setSelectedPrefs)}
                        style={{
                          padding: "4px 10px",
                          borderRadius: "4px",
                          border: "1px solid",
                          borderColor: selectedPrefs.includes(p) ? "#3182ce" : "#e2e8f0",
                          backgroundColor: selectedPrefs.includes(p) ? "#3182ce" : "#fff",
                          color: selectedPrefs.includes(p) ? "#fff" : "#4a5568",
                          fontSize: "0.75rem",
                          cursor: "pointer"
                        }}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          // 案件リストのタイトルと件数表示
          <h2 style={{ fontSize: "1.2rem", fontWeight: "800", marginBottom: "20px" }}>
            {viewMode === "all" ? "案件一覧" : viewMode === "applied" ? "応募済み案件" : viewMode === "favorites" ? "お気に入り案件" : "閲覧履歴"} ({filtered.length}件)
          </h2>
          // 案件リスト表示エリア
          {loading ? (
            <div style={{ textAlign: "center", padding: "100px 0" }}>読み込み中...</div>
          ) : (
            <>
            // 絞り込み後の案件が0件の場合の表示と、案件カードのグリッド表示
              {filtered.length === 0 ? (
                <div style={{ textAlign: "center", padding: "50px", color: "#718096" }}>条件に一致する案件が見つかりませんでした。</div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "25px" }}>
                  {currentItems.map((p) => <ProjectCard key={p.id} project={p} />)}
                </div>
              )}
              {totalPages > 1 && (
                <div style={{ display: "flex", justifyContent: "center", gap: "10px", marginTop: "40px", marginBottom: "40px" }}>
                  {[...Array(totalPages)].map((_, i) => (
                    <button key={i} onClick={() => { setCurrentPage(i + 1); window.scrollTo(0, 0); }} style={{ padding: "8px 16px", borderRadius: "6px", border: "1px solid #cbd5e0", backgroundColor: currentPage === i + 1 ? "#1a365d" : "#fff", color: currentPage === i + 1 ? "#fff" : "#2d3748", cursor: "pointer" }}>{i + 1}</button>
                  ))}
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* 詳細モーダル */}
      {selectedProject && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.6)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }} onClick={() => setSelectedProject(null)}>
          <div style={{ backgroundColor: "#fff", width: "95%", maxWidth: "800px", borderRadius: "12px", padding: "40px", maxHeight: "80vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ color: "#1a365d", marginBottom: "20px" }}>{selectedProject.title}</h2>
            <div style={{ whiteSpace: "pre-wrap", lineHeight: "1.7", fontSize: "0.95rem" }}>{formatContent(selectedProject.content)}</div>
            <button onClick={() => setSelectedProject(null)} style={{ marginTop: "30px", padding: "10px 30px", backgroundColor: "#edf2f7", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}>閉じる</button>
          </div>
        </div>
      )}

      {/* 削除確認モーダル */}
      {deleteTargetId && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.6)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1100 }} onClick={() => setDeleteTargetId(null)}>
          <div style={{ backgroundColor: "#fff", padding: "30px", borderRadius: "12px", textAlign: "center" }} onClick={e => e.stopPropagation()}>
            <p style={{ marginBottom: "20px", fontWeight: "bold" }}>この案件を削除してもよろしいですか？</p>
            <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
              <button onClick={() => setDeleteTargetId(null)} style={{ padding: "10px 20px", borderRadius: "6px", border: "1px solid #cbd5e0", background: "#fff", cursor: "pointer" }}>キャンセル</button>
              <button onClick={handleExecuteDelete} style={{ padding: "10px 20px", borderRadius: "6px", border: "none", background: "#e53e3e", color: "#fff", cursor: "pointer" }}>削除する</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}