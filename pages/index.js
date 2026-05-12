import { useEffect, useState } from "react";

export default function Home() {
  const [mails, setMails] = useState([]);
  const [loading, setLoading] = useState(true);

  // 入力用と確定用の状態
  const [inputWord, setInputWord] = useState("");
  const [inputLocation, setInputLocation] = useState("");
  const [searchWord, setSearchWord] = useState("");
  const [searchLocation, setSearchLocation] = useState("");

  useEffect(() => {
    fetch("/api/mails")
      .then((res) => res.json())
      .then((payload) => {
        if (payload.error) {
          console.error("Supabaseエラー:", payload.error);
        } else {
          setMails(payload.data || []);
        }
      })
      .catch((err) => console.error("ネットワークエラー:", err))
      .finally(() => setLoading(false));
  }, []);

  const handleSearch = () => {
    setSearchWord(inputWord);
    setSearchLocation(inputLocation);
  };

  const filteredMails = mails.filter((mail) => {
    const title = (mail.title || "").toLowerCase();
    const skills = (mail.skills || "").toLowerCase();
    const location = (mail.location || "").toLowerCase();
    const wordTarget = searchWord.toLowerCase();
    const locationTarget = searchLocation.toLowerCase();

    return (title.includes(wordTarget) || skills.includes(wordTarget)) && location.includes(locationTarget);
  });

  return (
    <div style={{ padding: "30px 20px", fontFamily: "sans-serif", maxWidth: "850px", margin: "0 auto", backgroundColor: "#f8f9fa", minHeight: "100vh" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#333", marginBottom: "20px", borderLeft: "5px solid #0070f3", paddingLeft: "15px" }}>案件検索</h1>
      
      {/* 検索エリア：一行にまとめたコンパクト設計 */}
      <div style={{ marginBottom: "25px", display: "flex", gap: "8px", alignItems: "center", backgroundColor: "#fff", padding: "12px", borderRadius: "8px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
        <input 
          type="text" 
          placeholder="キーワード" 
          value={inputWord}
          onChange={(e) => setInputWord(e.target.value)}
          style={smallInputStyle}
        />
        <input 
          type="text" 
          placeholder="📍 場所" 
          value={inputLocation}
          onChange={(e) => setInputLocation(e.target.value)}
          style={{ ...smallInputStyle, width: "120px" }}
        />
        <button 
          onClick={handleSearch}
          style={smallButtonStyle}
          onMouseOver={(e) => e.target.style.backgroundColor = "#0056b3"}
          onMouseOut={(e) => e.target.style.backgroundColor = "#0070f3"}
        >
          検索
        </button>
      </div>

      {/* 検索状態の表示（ヒット数など） */}
      {(searchWord || searchLocation) && (
        <div style={{ marginBottom: "15px", fontSize: "0.85rem", color: "#666" }}>
          結果: <strong>{filteredMails.length}</strong> 件 {searchWord && ` / 「${searchWord}」`} {searchLocation && ` / 📍${searchLocation}`}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: "40px", color: "#0070f3" }}>読み込み中...</div>
      ) : filteredMails.length > 0 ? (
        filteredMails.map((mail) => (
          <div key={mail.id} style={compactCardStyle}>
            <div style={{ fontWeight: "bold", fontSize: "1.1rem", color: "#1a1a1a" }}>{mail.title || "（タイトルなし）"}</div>
            <div style={{ fontSize: "0.85rem", color: "#0070f3", marginTop: "5px" }}>📩 {mail.sender_address || "不明"}</div>
            <div style={{ fontSize: "0.85rem", color: "#555", marginTop: "5px" }}>
              <span style={{ marginRight: "15px" }}>📍 {mail.location || "未定"}</span>
              <span>💰 {mail.price || "応相談"}</span>
            </div>
            <div style={compactSkillStyle}>
              <div dangerouslySetInnerHTML={{ __html: mail.skills || "スキル情報なし" }} />
            </div>
          </div>
        ))
      ) : (
        <div style={{ textAlign: "center", padding: "40px", backgroundColor: "#fff", borderRadius: "8px", color: "#888" }}>
          案件が見つかりませんでした。
        </div>
      )}
    </div>
  );
}

// コンパクトなスタイル定義
const smallInputStyle = {
  flex: 1,
  padding: "8px 12px",
  borderRadius: "6px",
  border: "1px solid #ddd",
  fontSize: "0.9rem",
  outline: "none"
};

const smallButtonStyle = {
  padding: "8px 20px",
  borderRadius: "6px",
  border: "none",
  backgroundColor: "#0070f3",
  color: "#fff",
  fontSize: "0.9rem",
  fontWeight: "bold",
  cursor: "pointer",
  whiteSpace: "nowrap"
};

const compactCardStyle = {
  padding: "18px",
  backgroundColor: "#fff",
  marginBottom: "12px",
  borderRadius: "8px",
  border: "1px solid #eee",
  boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
};

const compactSkillStyle = {
  marginTop: "10px",
  padding: "10px",
  backgroundColor: "#f9f9f9",
  borderRadius: "6px",
  fontSize: "0.8rem",
  color: "#444",
  lineHeight: "1.5"
};