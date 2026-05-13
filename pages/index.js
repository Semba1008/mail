// pages/index.js
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
  const projectsPerPage = 9;

  // 1. APIからデータ取得
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

  // 2. お気に入り切り替え
  const toggleFavorite = (id) => {
    const updated = projects.map((p) => p.id === id ? { ...p, favorite: !p.favorite } : p);
    setProjects(updated);
    const favIds = updated.filter(p => p.favorite).map(p => p.id);
    localStorage.setItem("favorites", JSON.stringify(favIds));
  };

  // 3. フィルタとページネーション
  const filtered = showFavoritesOnly ? projects.filter(p => p.favorite) : projects;
  const currentItems = filtered.slice((currentPage - 1) * projectsPerPage, currentPage * projectsPerPage);
  const totalPages = Math.ceil(filtered.length / projectsPerPage);

  return (
    <div style={{ backgroundColor: "#f4f7f9", minHeight: "100vh", padding: "40px 20px", fontFamily: "sans-serif" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        <h1 style={{ textAlign: "center", color: "#333", marginBottom: "30px" }}>案件一覧システム</h1>

        <div style={{ display: "flex", justifyContent: "center", marginBottom: "30px" }}>
          <button
            onClick={() => { setShowFavoritesOnly(!showFavoritesOnly); setCurrentPage(1); }}
            style={{ padding: "12px 24px", border: "none", borderRadius: "10px", backgroundColor: showFavoritesOnly ? "#ff4d4f" : "#faad14", color: "#fff", cursor: "pointer", fontWeight: "bold" }}
          >
            {showFavoritesOnly ? "全ての案件を表示" : "お気に入りのみ表示"}
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: "center" }}>読み込み中...</div>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "25px" }}>
              {currentItems.map((project) => (
                <div key={project.id} style={{ backgroundColor: "#fff", borderRadius: "12px", boxShadow: "0 4px 12px rgba(0,0,0,0.08)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
                  <div style={{ padding: "20px", flexGrow: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "#999", fontSize: "0.8rem" }}>ID: {project.id}</span>
                      <button onClick={() => toggleFavorite(project.id)} style={{ border: "none", background: "none", cursor: "pointer", fontSize: "1.5rem" }}>
                        {project.favorite ? "⭐" : "☆"}
                      </button>
                    </div>
                    <h2 style={{ fontSize: "1.1rem", color: "#003a8c", margin: "10px 0" }}>{project.title}</h2>
                    <p>📍 {project.location}</p>
                    <p style={{ color: "#d46b08", fontWeight: "bold" }}>💰 {project.price}</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", marginTop: "10px" }}>
                      {(project.skills || "").split(",").map((s, i) => (
                        <span key={i} style={{ backgroundColor: "#e6f4ff", color: "#0050b3", padding: "2px 8px", borderRadius: "4px", fontSize: "0.7rem" }}>{s.trim()}</span>
                      ))}
                    </div>
                  </div>
                  <button onClick={() => setSelectedProject(project)} style={{ backgroundColor: "#1d39c4", color: "#fff", border: "none", padding: "12px", cursor: "pointer" }}>詳細を見る</button>
                </div>
              ))}
            </div>

            {/* ページネーション */}
            <div style={{ display: "flex", justifyContent: "center", marginTop: "30px", gap: "10px" }}>
              {[...Array(totalPages)].map((_, i) => (
                <button key={i} onClick={() => { setCurrentPage(i + 1); window.scrollTo(0, 0); }} style={{ padding: "8px 12px", backgroundColor: currentPage === i + 1 ? "#1d39c4" : "#fff", color: currentPage === i + 1 ? "#fff" : "#333", border: "1px solid #ddd", cursor: "pointer" }}>{i + 1}</button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* モーダル部分 */}
      {selectedProject && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(0,0,0,0.6)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }} onClick={() => setSelectedProject(null)}>
          <div style={{ backgroundColor: "#fff", width: "90%", maxWidth: "800px", maxHeight: "80vh", borderRadius: "15px", padding: "30px", overflowY: "auto", position: "relative" }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setSelectedProject(null)} style={{ position: "absolute", top: "15px", right: "15px", border: "none", background: "none", fontSize: "1.2rem", cursor: "pointer" }}>✕</button>
            <h2>{selectedProject.title}</h2>
            <div style={{ backgroundColor: "#f9f9f9", padding: "20px", borderRadius: "8px", whiteSpace: "pre-wrap" }}>
              {selectedProject.content ? decodeHtml(selectedProject.content) : "詳細なし"}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}