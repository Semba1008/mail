import { useEffect, useState } from "react";

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

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await fetch("/api/projects");
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

  const toggleFavorite = (id) => {
    const updated = projects.map((p) => p.id === id ? { ...p, favorite: !p.favorite } : p);
    setProjects(updated);
    const favIds = updated.filter(p => p.favorite).map(p => p.id);
    localStorage.setItem("favorites", JSON.stringify(favIds));
  };

  // フィルタリング（お気に入り + 検索窓）
  const filtered = projects.filter(p => {
    const matchesFavorite = showFavoritesOnly ? p.favorite : true;
    const matchesSearch = p.title?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.skills?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFavorite && matchesSearch;
  });

  const currentItems = filtered.slice((currentPage - 1) * projectsPerPage, currentPage * projectsPerPage);
  const totalPages = Math.ceil(filtered.length / projectsPerPage);

  return (
    <div style={{ backgroundColor: "#f0f2f5", minHeight: "100vh", fontFamily: "'Helvetica Neue', Arial, sans-serif" }}>
      {/* ヘッダーエリア (image_567c61.jpg 風) */}
      <div style={{ backgroundColor: "#fff", padding: "40px 20px", boxShadow: "0 2px 10px rgba(0,0,0,0.05)", marginBottom: "40px" }}>
        <div style={{ maxWidth: "800px", margin: "0 auto", textAlign: "center" }}>
          <h1 style={{ color: "#003a8c", fontSize: "1.8rem", marginBottom: "30px" }}>案件情報検索</h1>
          <div style={{ display: "flex", gap: "10px", backgroundColor: "#fff", padding: "15px", borderRadius: "12px", boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }}>
            <input 
              type="text" 
              placeholder="キーワード検索（スキルや案件名）" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ flex: 1, padding: "12px", border: "1px solid #ddd", borderRadius: "6px", outline: "none" }}
            />
            <button 
              onClick={() => { setShowFavoritesOnly(!showFavoritesOnly); setCurrentPage(1); }}
              style={{ padding: "0 20px", border: "none", borderRadius: "6px", backgroundColor: showFavoritesOnly ? "#ff4d4f" : "#faad14", color: "#fff", fontWeight: "bold", cursor: "pointer" }}
            >
              {showFavoritesOnly ? "⭐ 解除" : "⭐ お気に入り"}
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 20px" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "100px" }}>読み込み中...</div>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))", gap: "30px" }}>
              {currentItems.map((project) => (
                <div key={project.id} style={{ backgroundColor: "#fff", borderRadius: "8px", overflow: "hidden", display: "flex", flexDirection: "column", position: "relative", border: "1px solid #e8e8e8" }}>
                  {/* NEWバッジ */}
                  <div style={{ position: "absolute", top: "15px", right: "15px", backgroundColor: "#ff4d4f", color: "#fff", fontSize: "0.7rem", padding: "2px 8px", borderRadius: "4px", fontWeight: "bold" }}>NEW</div>
                  
                  <div style={{ padding: "25px", flexGrow: 1 }}>
                    <div style={{ color: "#999", fontSize: "0.8rem", marginBottom: "10px" }}>OA{project.id.toString().padStart(4, '0')}</div>
                    <h2 style={{ fontSize: "1.1rem", color: "#1d39c4", marginBottom: "20px", lineHeight: "1.5", fontWeight: "bold", cursor: "pointer" }} onClick={() => setSelectedProject(project)}>
                      {project.title}
                    </h2>

                    <div style={{ display: "grid", gridTemplateColumns: "80px 1fr", gap: "10px", fontSize: "0.9rem", color: "#555", lineHeight: "1.8" }}>
                      <div style={{ fontWeight: "bold" }}>【場所】</div>
                      <div>{project.location || "確認中"}</div>
                      <div style={{ fontWeight: "bold" }}>【単価】</div>
                      <div style={{ color: "#333" }}>{project.price || "スキル見合い"}</div>
                      <div style={{ fontWeight: "bold" }}>【スキル】</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                        {(project.skills || "").split(",").map((s, i) => (
                          <span key={i} style={{ backgroundColor: "#f0f5ff", color: "#1d39c4", padding: "0 8px", borderRadius: "2px", fontSize: "0.75rem", border: "1px solid #adc6ff" }}>{s.trim()}</span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", borderTop: "1px solid #f0f0f0" }}>
                    <button 
                      onClick={() => toggleFavorite(project.id)} 
                      style={{ flex: 1, padding: "12px", border: "none", backgroundColor: "#fff", cursor: "pointer", fontSize: "1.2rem", borderRight: "1px solid #f0f0f0" }}
                    >
                      {project.favorite ? "⭐" : "☆"}
                    </button>
                    <button 
                      onClick={() => setSelectedProject(project)} 
                      style={{ flex: 4, backgroundColor: "#003a8c", color: "#fff", border: "none", padding: "12px", cursor: "pointer", fontWeight: "bold" }}
                    >
                      詳細を見る
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* ページネーション */}
            <div style={{ display: "flex", justifyContent: "center", margin: "50px 0", gap: "8px" }}>
              {[...Array(totalPages)].map((_, i) => (
                <button 
                  key={i} 
                  onClick={() => { setCurrentPage(i + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }} 
                  style={{ width: "35px", height: "35px", backgroundColor: currentPage === i + 1 ? "#003a8c" : "#fff", color: currentPage === i + 1 ? "#fff" : "#333", border: "1px solid #d9d9d9", borderRadius: "4px", cursor: "pointer" }}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* モーダル */}
      {selectedProject && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(0,0,0,0.7)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, padding: "20px" }} onClick={() => setSelectedProject(null)}>
          <div style={{ backgroundColor: "#fff", width: "100%", maxWidth: "800px", borderRadius: "12px", padding: "40px", position: "relative", maxHeight: "90vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setSelectedProject(null)} style={{ position: "absolute", top: "20px", right: "20px", border: "none", background: "none", fontSize: "1.5rem", cursor: "pointer", color: "#999" }}>✕</button>
            <h2 style={{ color: "#003a8c", marginBottom: "20px", borderBottom: "2px solid #f0f0f0", paddingBottom: "10px" }}>{selectedProject.title}</h2>
            <div style={{ backgroundColor: "#f5f5f5", padding: "25px", borderRadius: "8px", whiteSpace: "pre-wrap", lineHeight: "1.8", color: "#333" }}>
              {selectedProject.content ? decodeHtml(selectedProject.content) : "詳細情報は現在準備中です。"}
            </div>
            {selectedProject.attachment_url && (
              <div style={{ marginTop: "20px" }}>
                <a href={selectedProject.attachment_url} target="_blank" rel="noopener noreferrer" style={{ color: "#1d39c4", textDecoration: "underline", fontWeight: "bold" }}>📎 資料を確認する</a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}