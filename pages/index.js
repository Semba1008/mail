import { useEffect, useState } from "react";

export default function Home() {
  const [mails, setMails] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");   // フリーワード検索
  const [searchLocation, setSearchLocation] = useState(""); // 場所検索
  const [loading, setLoading] = useState(true);

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

  // 【改良】複数条件での絞り込みロジック
  const filteredMails = mails.filter((mail) => {
    const title = (mail.title || "").toLowerCase();
    const skills = (mail.skills || "").toLowerCase();
    const location = (mail.location || "").toLowerCase();
    
    const wordTarget = searchTerm.toLowerCase();
    const locationTarget = searchLocation.toLowerCase();

    // フリーワードが「タイトル」か「スキル」に含まれ、かつ「場所」も一致するもの
    const matchesWord = title.includes(wordTarget) || skills.includes(wordTarget);
    const matchesLocation = location.includes(locationTarget);

    return matchesWord && matchesLocation;
  });

  return (
    <div style={{ padding: "40px", fontFamily: "sans-serif", maxWidth: "800px", margin: "0 auto", backgroundColor: "#f4f7f6", minHeight: "100vh" }}>
      <h1 style={{ borderBottom: "3px solid #0070f3", paddingBottom: "15px", color: "#333", marginBottom: "30px" }}>案件一覧</h1>
      
      {/* 検索エリア（2つのインポートを横並びまたは縦に配置） */}
      <div style={{ marginBottom: "30px", display: "flex", flexDirection: "column", gap: "10px" }}>
        <div style={{ display: "flex", gap: "10px" }}>
          <input 
            type="text" 
            placeholder="フリーワード（案件名・スキル）" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={inputStyle}
          />
          <input 
            type="text" 
            placeholder="📍 場所（東京、リモート等）" 
            value={searchLocation}
            onChange={(e) => setSearchLocation(e.target.value)}
            style={{ ...inputStyle, flex: "0 0 35%" }} // 場所入力は少し短めに
          />
        </div>
        {(searchTerm || searchLocation) && (
          <div style={{ fontSize: "0.9rem", color: "#666", paddingLeft: "5px" }}>
            検索結果: {filteredMails.length} 件
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "50px", color: "#0070f3", fontWeight: "bold" }}>データを読み込み中...</div>
      ) : filteredMails.length > 0 ? (
        filteredMails.map((mail) => (
          <div key={mail.id} style={cardStyle}>
            <div style={{ fontWeight: "bold", fontSize: "1.3rem", color: "#1a1a1a" }}>
              {mail.title || "（タイトルなし）"}
            </div>

            <div style={{ fontSize: "0.9rem", color: "#0070f3", marginTop: "8px", fontWeight: "500" }}>
              📩 送信元: {mail.sender_address || "不明"}
            </div>

            <div style={{ fontSize: "0.95rem", color: "#444", marginTop: "8px", display: "flex", gap: "15px" }}>
              <span style={{ backgroundColor: "#e0f2f1", padding: "2px 8px", borderRadius: "4px" }}>
                📍 {mail.location || "未定"}
              </span>
              <span>💰 {mail.price || "応相談"}</span>
            </div>

            <div style={skillBoxStyle}>
              <strong style={{ color: "#0070f3", display: "block", marginBottom: "5px" }}>必須スキル:</strong>
              <div dangerouslySetInnerHTML={{ __html: mail.skills || "記載なし" }} />
            </div>
            
            <div style={{ fontSize: "0.8rem", color: "#a0aec0", marginTop: "15px", textAlign: "right" }}>
              受信日時: {mail.created_at ? new Date(mail.created_at).toLocaleString("ja-JP") : "不明"}
            </div>
          </div>
        ))
      ) : (
        <div style={emptyStateStyle}>
          <p style={{ fontSize: "1.1rem", fontWeight: "bold" }}>条件に一致する案件が見つかりません。</p>
          <button 
            onClick={() => {setSearchTerm(""); setSearchLocation("");}}
            style={{ marginTop: "10px", color: "#0070f3", border: "none", background: "none", cursor: "pointer", textDecoration: "underline" }}
          >
            検索条件をクリアする
          </button>
        </div>
      )}
    </div>
  );
}

// デザイン用の共通スタイル
const inputStyle = {
  flex: 1,
  padding: "12px 15px",
  borderRadius: "8px",
  border: "2px solid #ddd",
  fontSize: "0.95rem",
  boxSizing: "border-box",
  outline: "none",
  backgroundColor: "#fff"
};

const cardStyle = {
  padding: "25px", 
  backgroundColor: "#fff",
  marginBottom: "20px",
  borderRadius: "12px",
  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
  border: "1px solid #eef2f1"
};

const skillBoxStyle = {
  marginTop: "15px", 
  padding: "15px", 
  backgroundColor: "#f0f4f8", 
  borderRadius: "8px", 
  fontSize: "0.9rem",
  lineHeight: "1.6",
  color: "#2d3748"
};

const emptyStateStyle = {
  textAlign: "center", 
  padding: "50px", 
  color: "#666", 
  backgroundColor: "#fff", 
  borderRadius: "12px",
  boxShadow: "0 2px 8px rgba(0,0,0,0.05)"
};