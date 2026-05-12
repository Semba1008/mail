import { useEffect, useState } from "react";

export default function Home() {
  const [mails, setMails] = useState([]);
  const [searchTerm, setSearchTerm] = useState(""); // 検索ワードの状態を追加
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // API経由でSupabaseのデータを取得
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

  // 【追加】検索ロジック：案件名(title)または必須スキル(skills)で絞り込む
  const filteredMails = mails.filter((mail) => {
    const title = (mail.title || "").toLowerCase();
    const skills = (mail.skills || "").toLowerCase();
    const target = searchTerm.toLowerCase();
    return title.includes(target) || skills.includes(target);
  });

  return (
    <div style={{ padding: "40px", fontFamily: "sans-serif", maxWidth: "800px", margin: "0 auto", backgroundColor: "#f4f7f6", minHeight: "100vh" }}>
      <h1 style={{ borderBottom: "3px solid #0070f3", paddingBottom: "15px", color: "#333", marginBottom: "30px" }}>案件一覧</h1>
      
      {/* 【追加】検索バーの設置 */}
      <div style={{ marginBottom: "30px" }}>
        <input 
          type="text" 
          placeholder="案件名やスキルで検索..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ 
            width: "100%", 
            padding: "15px", 
            borderRadius: "10px", 
            border: "2px solid #ddd", 
            fontSize: "1rem",
            boxSizing: "border-box",
            outline: "none",
            boxShadow: "0 2px 10px rgba(0,0,0,0.05)"
          }}
        />
        {searchTerm && (
          <div style={{ marginTop: "10px", fontSize: "0.9rem", color: "#666" }}>
            「{searchTerm}」の検索結果: {filteredMails.length} 件
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "50px", color: "#0070f3", fontWeight: "bold" }}>データを読み込み中...</div>
      ) : filteredMails.length > 0 ? (
        filteredMails.map((mail) => (
          <div key={mail.id} style={{ 
            padding: "25px", 
            backgroundColor: "#fff",
            marginBottom: "20px",
            borderRadius: "12px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
            border: "1px solid #eef2f1"
          }}>
            {/* 案件名を表示 */}
            <div style={{ fontWeight: "bold", fontSize: "1.3rem", color: "#1a1a1a" }}>
              {mail.title || "（タイトルなし）"}
            </div>

            {/* 送信元アドレス */}
            <div style={{ fontSize: "0.9rem", color: "#0070f3", marginTop: "8px", fontWeight: "500" }}>
              📩 送信元: {mail.sender_address || "不明"}
            </div>

            {/* 勤務地と単価 */}
            <div style={{ fontSize: "0.95rem", color: "#444", marginTop: "8px", display: "flex", gap: "15px" }}>
              <span>📍 {mail.location || "未定"}</span>
              <span>💰 {mail.price || "応相談"}</span>
            </div>

            {/* 必須スキル */}
            <div style={{ 
              marginTop: "15px", 
              padding: "15px", 
              backgroundColor: "#f0f4f8", 
              borderRadius: "8px", 
              fontSize: "0.9rem",
              lineHeight: "1.6",
              color: "#2d3748"
            }}>
              <strong style={{ color: "#0070f3", display: "block", marginBottom: "5px" }}>必須スキル:</strong>
              <div dangerouslySetInnerHTML={{ __html: mail.skills || "記載なし" }} />
            </div>
            
            {/* 受信日時 */}
            <div style={{ fontSize: "0.8rem", color: "#a0aec0", marginTop: "15px", textAlign: "right" }}>
              受信日時: {mail.created_at ? new Date(mail.created_at).toLocaleString("ja-JP") : "不明"}
            </div>
          </div>
        ))
      ) : (
        <div style={{ textAlign: "center", padding: "50px", color: "#666", backgroundColor: "#fff", borderRadius: "12px" }}>
          <p style={{ fontSize: "1.1rem", fontWeight: "bold" }}>該当する案件が見つかりません。</p>
          <p style={{ fontSize: "0.85rem", marginTop: "10px" }}>別のキーワードで試すか、環境変数・RLS設定を確認してください。</p>
        </div>
      )}
    </div>
  );
}