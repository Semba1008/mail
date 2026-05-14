import { useEffect, useState } from "react";
 
const formatContent = (html) => {
  if (typeof window === "undefined") return html;
  const txt = document.createElement("textarea");
  txt.innerHTML = html;
  const decoded = txt.value;
  const urlRegex = /(https?:\/\/[^\s]+|[\w.-]+@[\w.-]+\.[a-zA-Z]{2,4})/g;
  const parts = decoded.split(urlRegex);
  return parts.map((part, i) => {
    if (part.match(/https?:\/\//)) {
      return <a key={i} href={part} target="_blank" rel="noopener noreferrer" style={{ color: "#3182ce", textDecoration: "underline" }}>{part}</a>;
    } else if (part.match(/[\w.-]+@[\w.-]+\.[a-zA-Z]{2,4}/)) {
      return <a key={i} href={`mailto:${part}`} style={{ color: "#3182ce", textDecoration: "underline" }}>{part}</a>;
    }
    return part;
  });
};
 
export default function Home() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [prefQuery, setPrefQuery] = useState(""); 
  const [isRemoteOnly, setIsRemoteOnly] = useState(false); // リモート絞り込み用
  const [selectedSkill, setSelectedSkill] = useState(null);
  const [viewMode, setViewMode] = useState("all"); 
  const [historyIds, setHistoryIds] = useState([]); 
  const projectsPerPage = 9;
 
  const prefectures = [
    "東京都", "神奈川県", "埼玉県", "千葉県", "大阪府", "京都府", "兵庫県", "愛知県", "福岡県", "北海道",
    "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県", "茨城県", "栃木県", "群馬県", "新潟県",
    "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県", "静岡県", "三重県", "滋賀県", "奈良県",
    "和歌山県", "鳥取県", "島根県", "岡山県", "広島県", "山口県", "徳島県", "香川県", "愛媛県", "高知県",
    "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県", "リモート"
  ];
 
  useEffect(() => {
    const fetchProjects = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/mails");
        const payload = await res.json();
        if (!payload.error) {
          const savedFavorites = JSON.parse(localStorage.getItem("favorites")) || [];
          const savedHistory = JSON.parse(localStorage.getItem("history")) || [];
          setHistoryIds(savedHistory);
          const dataWithFavs = (payload.data || []).map(item => ({
            ...item,
            favorite: savedFavorites.includes(item.id)
          }));
          setProjects(dataWithFavs);
        }
      } catch (err) { console.error(err); } 
      finally {
        setTimeout(() => setLoading(false), 800);
      }
    };
    fetchProjects();
  }, []);
 
  const addToHistory = (project) => {
    if (!historyIds.includes(project.id)) {
      const newHistory = [project.id, ...historyIds].slice(0, 50); 
      setHistoryIds(newHistory);
      localStorage.setItem("history", JSON.stringify(newHistory));
    }
    setSelectedProject(project);
  };
 
  const filtered = projects.filter(p => {
    if (viewMode === "favorites") return p.favorite;
    if (viewMode === "history") return historyIds.includes(p.id);
    const matchesSearch = p.title?.toLowerCase().includes(searchQuery.toLowerCase()) || p.skills?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPref = prefQuery === "" ? true : p.location?.includes(prefQuery);
    const matchesSkill = selectedSkill ? p.skills?.includes(selectedSkill) : true;
    const matchesRemote = isRemoteOnly ? (p.location?.includes("リモート") || p.title?.includes("リモート")) : true;
    return matchesSearch && matchesPref && matchesSkill && matchesRemote;
  });
 
  const totalPages = Math.max(1, Math.ceil(filtered.length / projectsPerPage));
  const currentItems = filtered.slice((currentPage - 1) * projectsPerPage, currentPage * projectsPerPage);
  const quickSkills = ["Java", "PHP", "Python", "React", "AWS", "Go"];
 
  const SkeletonCard = () => (
<div style={{ backgroundColor: "#fff", borderRadius: "10px", height: "320px", border: "1px solid #edf2f7", padding: "30px", display: "flex", flexDirection: "column", gap: "20px" }}>
<div className="skeleton-box" style={{ width: "30%", height: "14px", backgroundColor: "#f0f4f8" }}></div>
<div className="skeleton-box" style={{ width: "100%", height: "24px", backgroundColor: "#f0f4f8" }}></div>
<div className="skeleton-box" style={{ width: "80%", height: "24px", backgroundColor: "#f0f4f8" }}></div>
<div style={{ borderTop: "1px solid #f7fafc", paddingTop: "20px", display: "flex", flexDirection: "column", gap: "10px" }}>
<div className="skeleton-box" style={{ width: "100%", height: "16px", backgroundColor: "#f0f4f8" }}></div>
<div className="skeleton-box" style={{ width: "100%", height: "16px", backgroundColor: "#f0f4f8" }}></div>
</div>
</div>
  );
 
  return (
<div style={{ backgroundColor: "#f7fafc", minHeight: "100vh", fontFamily: "'Hiragino Sans', 'Meiryo', sans-serif", color: "#2d3748" }}>
<nav style={{ backgroundColor: "#1a365d", position: "sticky", top: 0, zIndex: 100 }}>
<div style={{ maxWidth: "1200px", margin: "0 auto", display: "flex", height: "60px", padding: "0 20px" }}>
          {[
            { id: "all", label: "案件を探す" }, 
            { id: "favorites", label: "お気に入り" }, 
            { id: "history", label: "閲覧履歴" }
          ].map(tab => (
<button key={tab.id} onClick={() => { setViewMode(tab.id); setCurrentPage(1); }} style={{ background: viewMode === tab.id ? "rgba(255,255,255,0.1)" : "none", border: "none", color: "#fff", cursor: "pointer", fontWeight: "600", padding: "0 25px", fontSize: "0.9rem" }}>
              {tab.label}
</button>
          ))}
</div>
</nav>
 
      <div style={{ backgroundColor: "#fff", padding: "50px 20px", borderBottom: "1px solid #e2e8f0" }}>
<div style={{ maxWidth: "800px", margin: "0 auto", textAlign: "center" }}>
          {/* 「案件情報検索」へ修正 */}
<h2 style={{ fontSize: "1.75rem", fontWeight: "800", color: "#1a365d", marginBottom: "30px" }}>
            {viewMode === "all" ? "案件情報検索" : viewMode === "favorites" ? "保存済み案件" : "閲覧履歴"}
</h2>
          {viewMode === "all" && (
<>
<div style={{ display: "flex", gap: "12px", marginBottom: "20px", alignItems: "center" }}>
<input type="text" placeholder="キーワード検索" value={searchQuery} onChange={(e) => {setSearchQuery(e.target.value); setCurrentPage(1);}} style={{ flex: 2, padding: "14px 20px", border: "1px solid #cbd5e0", borderRadius: "8px", fontSize: "1rem" }} />
<select value={prefQuery} onChange={(e) => {setPrefQuery(e.target.value); setCurrentPage(1);}} style={{ flex: 1, padding: "14px 20px", border: "1px solid #cbd5e0", borderRadius: "8px", cursor: "pointer", backgroundColor: "#fff" }}>
<option value="">都道府県</option>
                  {prefectures.map(p => <option key={p} value={p}>{p}</option>)}
</select>
                {/* リモート絞り込み追加 */}
<label style={{ display: "flex", alignItems: "center", gap: "5px", cursor: "pointer", fontSize: "0.85rem", whiteSpace: "nowrap", color: "#4a5568", fontWeight: "bold" }}>
<input type="checkbox" checked={isRemoteOnly} onChange={(e) => {setIsRemoteOnly(e.target.checked); setCurrentPage(1);}} style={{ width: "18px", height: "18px" }} />
                  リモートのみ
</label>
</div>
<div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "8px" }}>
                {quickSkills.map(skill => (
<button key={skill} onClick={() => {setSelectedSkill(selectedSkill === skill ? null : skill); setCurrentPage(1);}} style={{ padding: "6px 18px", borderRadius: "20px", border: "1px solid #1a365d", backgroundColor: selectedSkill === skill ? "#1a365d" : "#fff", color: selectedSkill === skill ? "#fff" : "#1a365d", cursor: "pointer", fontSize: "0.85rem", fontWeight: "600" }}>{skill}</button>
                ))}
</div>
</>
          )}
</div>
</div>
 
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "50px 20px" }}>
<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "30px" }}>
          {loading ? [...Array(6)].map((_, i) => <SkeletonCard key={i} />) : 
            currentItems.map((project) => (
<div key={project.id} className="card" style={{ backgroundColor: "#fff", borderRadius: "10px", padding: "30px", border: "1px solid #edf2f7", display: "flex", flexDirection: "column", position: "relative", transition: "all 0.3s ease", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)" }}>
<div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "15px" }}>
<span style={{ fontSize: "0.75rem", color: "#a0aec0", letterSpacing: "0.05em" }}>OA{project.id.toString().slice(0, 4)}</span>
<div style={{ display: "flex", gap: "8px" }}>
                    {historyIds.includes(project.id) && <span style={{ backgroundColor: "#edf2f7", color: "#718096", fontSize: "0.65rem", padding: "2px 8px", borderRadius: "4px", fontWeight: "bold" }}>既読</span>}
<span style={{ backgroundColor: "#e53e3e", color: "#fff", fontSize: "0.65rem", padding: "2px 8px", borderRadius: "12px", fontWeight: "bold" }}>NEW</span>
</div>
</div>
<h3 style={{ fontSize: "1.2rem", color: "#1a365d", marginBottom: "25px", fontWeight: "700", lineHeight: "1.6", minHeight: "3.2em" }}>
                  {project.title}
</h3>
 
                <div style={{ borderTop: "1px solid #f7fafc", paddingTop: "20px", display: "flex", flexDirection: "column", gap: "12px" }}>
<div style={{ display: "flex", fontSize: "0.95rem" }}>
<span style={{ color: "#718096", width: "90px", fontWeight: "600" }}>【場所】</span>
<span style={{ color: "#4a5568" }}>{project.location || "確認中"}</span>
</div>
<div style={{ display: "flex", fontSize: "0.95rem" }}>
<span style={{ color: "#718096", width: "90px", fontWeight: "600" }}>【単価】</span>
<span style={{ color: "#1a365d", fontWeight: "700" }}>{project.price || "面談時相談"}</span>
</div>
</div>
 
                <div style={{ display: "flex", marginTop: "30px", gap: "12px" }}>
<button onClick={() => {
                    const updated = projects.map((p) => p.id === project.id ? { ...p, favorite: !p.favorite } : p);
                    setProjects(updated);
                    localStorage.setItem("favorites", JSON.stringify(updated.filter(p => p.favorite).map(p => p.id)));
                  }} style={{ width: "50px", height: "45px", borderRadius: "8px", border: "1px solid #cbd5e0", background: project.favorite ? "#f6ad55" : "#fff", color: project.favorite ? "#fff" : "#cbd5e0", cursor: "pointer", fontSize: "1.2rem" }}>
                    {project.favorite ? "★" : "☆"}
</button>
<button onClick={() => addToHistory(project)} style={{ flex: 1, backgroundColor: "#1a365d", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "700", fontSize: "0.9rem", transition: "opacity 0.2s" }}>
                    詳細を確認する
</button>
</div>
</div>
            ))
          }
</div>
 
        {!loading && totalPages > 1 && (
<div style={{ display: "flex", justifyContent: "center", marginTop: "60px", gap: "8px" }}>
            {[...Array(totalPages)].map((_, i) => (
<button key={i} onClick={() => { setCurrentPage(i + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={{ width: "40px", height: "40px", backgroundColor: currentPage === i + 1 ? "#1a365d" : "#fff", color: currentPage === i + 1 ? "#fff" : "#1a365d", border: "1px solid #e2e8f0", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}>{i + 1}</button>
            ))}
</div>
        )}
</div>
 
      {selectedProject && (
<div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(26, 54, 93, 0.7)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, padding: "20px" }} onClick={() => setSelectedProject(null)}>
<div style={{ backgroundColor: "#fff", width: "100%", maxWidth: "850px", borderRadius: "16px", padding: "40px", maxHeight: "85vh", overflowY: "auto", position: "relative", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)" }} onClick={e => e.stopPropagation()}>
<button onClick={() => setSelectedProject(null)} style={{ position: "absolute", top: "20px", right: "20px", border: "none", background: "#f7fafc", width: "40px", height: "40px", borderRadius: "20px", cursor: "pointer", color: "#4a5568", fontSize: "1.2rem" }}>✕</button>
<h2 style={{ fontSize: "1.5rem", color: "#1a365d", marginBottom: "30px", fontWeight: "800", paddingRight: "40px", lineHeight: "1.5" }}>{selectedProject.title}</h2>
<div style={{ backgroundColor: "#f8fafc", padding: "30px", borderRadius: "12px", border: "1px solid #edf2f7", whiteSpace: "pre-wrap", lineHeight: "1.8", fontSize: "1rem", color: "#2d3748" }}>
              {selectedProject.content ? formatContent(selectedProject.content) : "詳細情報はありません。"}
</div>
</div>
</div>
      )}
 
      <style jsx>{`
        .card:hover { transform: translateY(-5px); box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); border-color: #cbd5e0; }
        .skeleton-box { position: relative; overflow: hidden; border-radius: 4px; }
        .skeleton-box::after {
          position: absolute; top: 0; right: 0; bottom: 0; left: 0;
          transform: translateX(-100%);
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
          animation: shimmer 1.5s infinite; content: "";
        }
        @keyframes shimmer { 100% { transform: translateX(100%); } }
      `}</style>
</div>
  );
}