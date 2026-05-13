import { useEffect, useState } from "react";

// HTMLエンティティをデコードする関数
const decodeHtml = (html) => {
  if (typeof window === "undefined") return html;
  const txt = document.createElement("textarea");
  txt.innerHTML = html;
  return txt.value;
};

export default function Home() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const projectsPerPage = 9;

  // データ取得
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await fetch("/api/mails");
        const payload = await res.json();
        if (!payload.error) {
          const savedFavorites = JSON.parse(localStorage.getItem("favorites")) || [];
          const dataWithFavs = (payload.data || []).map(item => ({
            ...item,
            favorite: savedFavorites.includes(item.id)
          }));
          setProjects(dataWithFavs);
        }
      } catch (err) {
        console.error("Fetch error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchProjects();
  }, []);

  // お気に入り切り替え
  const toggleFavorite = (id) => {
    const updated = projects.map((p) => p.id === id ? { ...p, favorite: !p.favorite } : p);
    setProjects(updated);
    const favIds = updated.filter(p => p.favorite).map(p => p.id);
    localStorage.setItem("favorites", JSON.stringify(favIds));
  };

  // フィルタリング
  const filtered = projects.filter(p => {
    const matchesFavorite = showFavoritesOnly ? p.favorite : true;
    const matchesSearch = 
      p.title?.toLowerCase().includes(searchQuery.toLowerCase()) || 
      p.skills?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.content?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFavorite && matchesSearch;
  });

  const currentItems = filtered.slice((currentPage - 1) * projectsPerPage, currentPage * projectsPerPage);
  const totalPages = Math.ceil(filtered.length / projectsPerPage);

  return (
    <div style={{ backgroundColor: "#f8f9fa", minHeight: "100vh", fontFamily: "'Hiragino Kaku Gothic ProN', 'Meiryo', sans-serif", color: "#333" }}>
      
      {/* ヘッダー・検索エリア (image_566d9d.png参照) */}
      <div style={{ backgroundColor: "#fff", padding: "60px 20px", textAlign: "center", borderBottom: "1px solid #eee" }}>
        <h1 style={{ color: "#003a8c", fontSize: "2rem", marginBottom: "40px", fontWeight: "bold" }}>案件情報検索</h1>
        <div style={{ maxWidth: "800px", margin: "0 auto", display: "flex", gap: "12px", padding: "10px", backgroundColor: "#fff", borderRadius: "12px", boxShadow: "0 10px 30px rgba(0,0,0,0.08)" }}>
          <input 
            type="text" 
            placeholder="キーワード検索（スキルや案件名）" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ flex: 1, padding: "15px", border: "1px solid #ddd", borderRadius: "8px", fontSize: "1rem", outline: "none" }}
          />
          <button 
            onClick={() => { setShowFavoritesOnly(!showFavoritesOnly); setCurrentPage(1); }}
            style={{ padding: "0 25px", border: "none", borderRadius: "8px", backgroundColor: showFavoritesOnly ? "#ff4d4f" : "#faad14", color: "#fff", fontWeight: "bold", cursor: "pointer", transition: "0.3s" }}
          >
            {showFavoritesOnly ? "★ お気に入り中" : "☆ お気に入り"}
          </button>
        </div>
      </div>

      <div style={{ maxWidth: "1300px", margin: "0 auto", padding: "40px 20px" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "100px", fontSize: "1.2rem" }}>読み込み中...</div>
        ) : (
          <>
            {/* 案件一覧グリッド (image_560b9d.png参照) */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "25px" }}>
              {currentItems.map((project) => (
                <div key={project.id} style={{ backgroundColor: "#fff", borderRadius: "10px", boxShadow: "0 4px 15px rgba(0,0,0,0.05)", display: "flex", flexDirection: "column", border: "1px solid #f0f0f0", position: "relative" }}>
                  
                  <div style={{ padding: "20px", flexGrow: 1 }}>
                    <div style={{ color: "#999", fontSize: "0.8rem", marginBottom: "10px" }}>OA{project.id}</div>
                    <h2 style={{ fontSize: "1.1rem", color: "#003a8c", marginBottom: "20px", height: "3em", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", lineHeight: "1.5" }}>
                      {project.title}
                    </h2>

                    {/* ラベル付き詳細情報 */}
                    <div style={{ display: "grid", gridTemplateColumns: "85px 1fr", gap: "8px", fontSize: "0.9rem", color: "#555" }}>
                      <div style={{ fontWeight: "bold" }}>【区分】</div>
                      <div>開発系</div> {/* 固定値またはDB項目へ */}
                      
                      <div style={{ fontWeight: "bold" }}>【概要】</div>
                      <div style={{ height: "3.6em", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {project.content ? decodeHtml(project.content).substring(0, 40) + "..." : "---"}
                      </div>

                      <div style={{ fontWeight: "bold" }}>【場所】</div>
                      <div>{project.location || "確認中"}</div>

                      <div style={{ fontWeight: "bold" }}>【単価】</div>
                      <div style={{ color: "#d46b08", fontWeight: "bold" }}>{project.price || "スキル見合い"}</div>
                    </div>
                  </div>

                  {/* カード下部ボタン */}
                  <div style={{ display: "flex", borderTop: "1px solid #f0f0f0" }}>
                    <button 
                      onClick={() => toggleFavorite(project.id)}
                      style={{ width: "60px", padding: "15px", border: "none", backgroundColor: "#fff", cursor: "pointer", borderRight: "1px solid #f0f0f0", fontSize: "1.3rem" }}
                    >
                      {project.favorite ? "⭐" : "☆"}
                    </button>
                    <button 
                      onClick={() => setSelectedProject(project)}
                      style={{ flex: 1, backgroundColor: "#1d39c4", color: "#fff", border: "none", padding: "15px", cursor: "pointer", fontWeight: "bold", borderBottomRightRadius: "10px" }}
                    >
                      詳細を見る
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* ページネーション */}
            <div style={{ display: "flex", justifyContent: "center", margin: "60px 0", gap: "10px" }}>
              {[...Array(totalPages)].map((_, i) => (
                <button 
                  key={i} 
                  onClick={() => { setCurrentPage(i + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }} 
                  style={{ width: "40px", height: "40px", backgroundColor: currentPage === i + 1 ? "#1d39c4" : "#fff", color: currentPage === i + 1 ? "#fff" : "#555", border: "1px solid #ddd", borderRadius: "5px", cursor: "pointer", fontWeight: "bold" }}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* 詳細モーダル (image_560f7d.png参照) */}
      {selectedProject && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(0,0,0,0.6)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, padding: "20px" }} onClick={() => setSelectedProject(null)}>
          <div style={{ backgroundColor: "#fff", width: "100%", maxWidth: "900px", borderRadius: "15px", padding: "40px", position: "relative", maxHeight: "90vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setSelectedProject(null)} style={{ position: "absolute", top: "20px", right: "20px", border: "none", background: "none", fontSize: "1.8rem", cursor: "pointer", color: "#ccc" }}>✕</button>
            
            <div style={{ color: "#999", marginBottom: "10px" }}>ID: OA{selectedProject.id}</div>
            <h2 style={{ color: "#1d39c4", fontSize: "1.6rem", marginBottom: "30px", lineHeight: "1.4" }}>{selectedProject.title}</h2>
            
            <div style={{ marginBottom: "30px" }}>
              <h3 style={{ fontSize: "1.1rem", borderLeft: "4px solid #1d39c4", paddingLeft: "10px", marginBottom: "15px" }}>案件概要</h3>
              <div style={{ backgroundColor: "#f9f9f9", padding: "20px", borderRadius: "8px", whiteSpace: "pre-wrap", lineHeight: "1.8", fontSize: "1rem" }}>
                {selectedProject.content ? decodeHtml(selectedProject.content) : "詳細情報はありません。"}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
              <div>
                <h3 style={{ fontSize: "1.1rem", borderLeft: "4px solid #1d39c4", paddingLeft: "10px", marginBottom: "10px" }}>場所</h3>
                <p style={{ paddingLeft: "14px" }}>{selectedProject.location || "確認中"}</p>
              </div>
              <div>
                <h3 style={{ fontSize: "1.1rem", borderLeft: "4px solid #1d39c4", paddingLeft: "10px", marginBottom: "10px" }}>単価</h3>
                <p style={{ paddingLeft: "14px", color: "#d46b08", fontWeight: "bold" }}>{selectedProject.price || "スキル見合い"}</p>
              </div>
            </div>

            <div style={{ marginTop: "30px" }}>
              <h3 style={{ fontSize: "1.1rem", borderLeft: "4px solid #1d39c4", paddingLeft: "10px", marginBottom: "10px" }}>スキル</h3>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", paddingLeft: "14px" }}>
                {(selectedProject.skills || "設定なし").split(",").map((s, i) => (
                  <span key={i} style={{ backgroundColor: "#e6f4ff", color: "#0050b3", padding: "5px 12px", borderRadius: "4px", fontSize: "0.85rem" }}>{s.trim()}</span>
                ))}
              </div>
            </div>

            {selectedProject.attachment_url && (
              <div style={{ marginTop: "40px", textAlign: "center" }}>
                <a href={selectedProject.attachment_url} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", backgroundColor: "#003a8c", color: "#fff", padding: "15px 40px", borderRadius: "30px", textDecoration: "none", fontWeight: "bold", boxShadow: "0 4px 10px rgba(0,58,140,0.3)" }}>
                  📎 関連資料をダウンロード
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}