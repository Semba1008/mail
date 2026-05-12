import { useEffect, useState } from "react";

export default function Home() {
  const [mails, setMails] = useState([]);

  useEffect(() => {
    fetch("/api/mails")
      .then(res => res.json())
      .then(payload => {
        // payload は { data, error } という形なので、
        // その中の data (配列) を setMails に渡す
        setMails(payload.data || []);
      })
      .catch(err => console.error("取得エラー:", err));
  }, []);

  return (
    <div style={{ padding: "20px" }}>
      <h1>メール一覧</h1>
      {mails.length > 0 ? (
        mails.map((mail, i) => (
          <div key={i} style={{ padding: "10px", borderBottom: "1px solid #eee" }}>
            {/* Supabaseのテーブルにあるカラム名（例: subject）に合わせて表示 */}
            {mail.subject || "（件名なし）"}
          </div>
        ))
      ) : (
        <p>メールが読み込めないか、データが空です。</p>
      )}
    </div>
  );
}