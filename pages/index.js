import { useState } from "react";

// デモデータ
const mockMails = [
  {
    id: 1,
    title: "Reactフロントエンド開発支援",
    sender_address: "abc-tech@example.com",
    location: "渋谷",
    price: "70万〜80万",
    skills: "React / TypeScript / Next.js",
  },
  {
    id: 2,
    title: "Javaバックエンド開発",
    sender_address: "system-link@example.com",
    location: "新宿",
    price: "65万〜75万",
    skills: "Java / Spring Boot / SQL",
  },
  {
    id: 3,
    title: "AWSインフラ運用案件",
    sender_address: "infra@example.com",
    location: "品川",
    price: "55万〜65万",
    skills: "AWS / Linux / Terraform",
  },
  {
    id: 4,
    title: "Pythonデータ分析案件",
    sender_address: "data@example.com",
    location: "大阪",
    price: "80万〜90万",
    skills: "Python / Pandas / SQL",
  },
];

export default function Home() {
  // Supabaseを使わずデモデータを直接使用
  const [mails] = useState(mockMails);
  const [loading] = useState(false);

  // 入力用と確定用の状態
  const [inputWord, setInputWord] = useState("");
  const [inputLocation, setInputLocation] = useState("");
  const [searchWord, setSearchWord] = useState("");
  const [searchLocation, setSearchLocation] = useState("");

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

    return (
      (title.includes(wordTarget) || skills.includes(wordTarget)) &&
      location.includes(locationTarget)
    );
  });

  return (
    <div
      style={{
        padding: "30px 20px",
        fontFamily: "sans-serif",
        maxWidth: "850px",
        margin: "0 auto",
        backgroundColor: "#f8f9fa",
        minHeight: "100vh",
      }}
    >
      <h1
        style={{
          fontSize: "1.5rem",
          fontWeight: "bold",
          color: "#333",
          marginBottom: "20px",
          borderLeft: "5px solid #0070f3",
          paddingLeft: "15px",
        }}
      >
        SES案件検索
      </h1>

      {/* 検索エリア */}
      <div
        style={{
          marginBottom: "25px",
          display: "flex",
          gap: "8px",
          alignItems: "center",
          backgroundColor: "#fff",
          padding: "12px",
          borderRadius: "8px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
        }}
      >
        <input
          type="text"
          placeholder="スキル・案件名"
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
          onMouseOver={(e) =>
            (e.target.style.backgroundColor = "#0056b3")
          }
          onMouseOut={(e) =>
            (e.target.style.backgroundColor = "#0070f3")
          }
        >
          検索
        </button>
      </div>

      {/* 件数表示 */}
      {(searchWord || searchLocation) && (
        <div
          style={{
            marginBottom: "15px",
            fontSize: "0.85rem",
            color: "#666",
          }}
        >
          結果:
          <strong> {filteredMails.length} </strong>
          件
        </div>
      )}

      {loading ? (
        <div
          style={{
            textAlign: "center",
            padding: "40px",
            color: "#0070f3",
          }}
        >
          読み込み中...
        </div>
      ) : filteredMails.length > 0 ? (
        filteredMails.map((mail) => (
          <div key={mail.id} style={compactCardStyle}>
            <div
              style={{
                fontWeight: "bold",
                fontSize: "1.1rem",
                color: "#1a1a1a",
              }}
            >
              {mail.title}
            </div>

            <div
              style={{
                fontSize: "0.85rem",
                color: "#0070f3",
                marginTop: "5px",
              }}
            >
              📩 {mail.sender_address}
            </div>

            <div
              style={{
                fontSize: "0.85rem",
                color: "#555",
                marginTop: "5px",
              }}
            >
              <span style={{ marginRight: "15px" }}>
                📍 {mail.location}
              </span>

              <span>💰 {mail.price}</span>
            </div>

            <div style={compactSkillStyle}>
              {mail.skills}
            </div>
          </div>
        ))
      ) : (
        <div
          style={{
            textAlign: "center",
            padding: "40px",
            backgroundColor: "#fff",
            borderRadius: "8px",
            color: "#888",
          }}
        >
          案件が見つかりませんでした。
        </div>
      )}
    </div>
  );
}

// スタイル
const smallInputStyle = {
  flex: 1,
  padding: "8px 12px",
  borderRadius: "6px",
  border: "1px solid #ddd",
  fontSize: "0.9rem",
  outline: "none",
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
  whiteSpace: "nowrap",
};

const compactCardStyle = {
  padding: "18px",
  backgroundColor: "#fff",
  marginBottom: "12px",
  borderRadius: "8px",
  border: "1px solid #eee",
  boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
};

const compactSkillStyle = {
  marginTop: "10px",
  padding: "10px",
  backgroundColor: "#f9f9f9",
  borderRadius: "6px",
  fontSize: "0.8rem",
  color: "#444",
  lineHeight: "1.5",
};