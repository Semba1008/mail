import { useEffect, useState } from "react";

export default function Home() {
  const [mails, setMails] = useState([]);
  const [loading, setLoading] = useState(true);

  // 入力中の文字を保持する状態
  const [inputWord, setInputWord] = useState("");
  const [inputLocation, setInputLocation] = useState("");

  // 実際に検索（フィルタリング）に使う状態
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

  // 検索ボタンを押した時の処理
  const handleSearch = () => {
    setSearchWord(inputWord);
    setSearchLocation(inputLocation);
  };

  // フィルタリングロジック（ボタンでセットされた値に基づいて計算）
  const filteredMails = mails.filter((mail) => {
    const title = (mail.title || "").toLowerCase();
    const skills = (mail.skills || "").toLowerCase();
    const location = (mail.location || "").toLowerCase();
    
    const wordTarget = searchWord.toLowerCase();
    const locationTarget = searchLocation.toLowerCase();

    const matchesWord = title.includes(wordTarget) || skills.includes(wordTarget);
    const matchesLocation = location.includes(locationTarget);

    return matchesWord && matchesLocation;
  });

  return (
    <div style={{ padding: "40px", fontFamily: "sans-serif", maxWidth: "800px", margin: "0 auto", backgroundColor: "#f4f7f6", minHeight: "100vh" }}>
      <h1 style={{ borderBottom: "3px solid #0070f3", paddingBottom: "15px", color: "#333", marginBottom: "30px" }}>案件検索システム</h1>
      
      {/* 検索エリア */}
      <div style={{ marginBottom: "30px", backgroundColor: "#fff", padding: "20px", borderRadius: "12px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
        <div style={{ display: "flex", gap: "10px", marginBottom: "15px" }}>
          <input 
            type="text" 
            placeholder="フリーワード（案件名・スキル）" 
            value={inputWord}
            onChange={(e) => setInputWord(e.target.value)}
            style={inputStyle}
          />
          <input 
            type="text" 
            placeholder="📍 場所" 
            value={inputLocation}
            onChange={(e) => setInputLocation(e.target.value)}
            style={{ ...inputStyle, flex: "0 0 30%" }}
          />
        </div>
        
        <button 
          onClick={handleSearch}
          style={buttonStyle}
          onMouseOver={(e) => e.target.style.backgroundColor = "#0056b3"}
          onMouseOut={(e) => e.target.style.backgroundColor = "#0070f3"}
        >
          🔍 この条件で検索する
        </button>

        {(searchWord || searchLocation) && (
          <div style={{ marginTop: "15px", fontSize: "0.9rem", color: "#666", display: "flex", justifyContent: "space-between" }}>
            <span>検索中: {searchWord} {searchLocation && ` / 📍${searchLocation}`}</span>
            <span>ヒット: <strong>{filteredMails.length}</strong> 件</span>
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "50px", color: "#0070f3", fontWeight: "bold" }}>データを読み込み中...</div>
      ) : filteredMails.length > 0 ? (
        filteredMails.map((mail) => (
          <div key={mail.id} style={cardStyle}>
            <div style={{ fontWeight: "bold", fontSize: "1.3rem", color: "#1a1a1a" }}>{mail.title || "（タイトルなし）"}</div>
            <div style={{ fontSize: "0.9rem", color: "#0070f3", marginTop: "8px" }}>📩 送信元: {mail.sender_address || "不明"}</div>
            <div style={{ fontSize: "0.95rem", color: "#444", marginTop: "8px", display: "flex", gap: "15px" }}>
              <span style={{ backgroundColor: "#e0f2f1", padding: "2px 8px", borderRadius: "4px" }}>📍 {mail.location || "未定"}</span>
              <span>💰 {mail.price || "応相談"}</span>
            </div>
            <div style={skillBoxStyle}>
              <strong style={{ color: "#0070f3", display: "block", marginBottom: "5px" }}>必須スキル:</strong>
              <div dangerouslySetInnerHTML={{ __html: mail.skills || "記載なし" }} />
            </div>
          </div>
        ))
      ) : (
        <div style={emptyStateStyle}>
          <p>該当する案件が見つかりませんでした。</p>
          <button onClick={() => {setInputWord(""); setInputLocation(""); setSearchWord(""); setSearchLocation("");}} style={{ color: "#0070f3", border: "none", background: "none", cursor: "pointer", textDecoration: "underline" }}>条件をリセット</button>
        </div>
      )}
    </div>
  );
}

// スタイル定義
const inputStyle = {
  flex: 1, padding: "12px 15px", borderRadius: "8px", border: "1px solid #ddd", fontSize: "0.95rem", outline: "none"
};

const buttonStyle = {
  width: "100%", padding: "12px", borderRadius: "8px", border: "none", backgroundColor: "#0070f3", color: "#fff", fontSize: "1rem", fontWeight: "bold", cursor: "pointer", transition: "background-color 0.2s"
};

const cardStyle = {
  padding: "25px", backgroundColor: "#fff", marginBottom: "20px", borderRadius: "12px", boxShadow: "0 4px 12px rgba(0,0,0,0.08)", border: "1px solid #eef2f1"
};

const skillBoxStyle = {
  marginTop: "15px", padding: "15px", backgroundColor: "#f0f4f8", borderRadius: "8px", fontSize: "0.9rem", color: "#2d3748"
};

const emptyStateStyle = {
  textAlign: "center", padding: "50px", color: "#666", backgroundColor: "#fff", borderRadius: "12px"
};