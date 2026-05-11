import { useEffect, useState } from "react";

export default function Home() {
  const [mails, setMails] = useState([]);

  useEffect(() => {
    fetch("/api/mails")
      .then(res => res.json())
      .then(data => setMails(data));
  }, []);

  return (
    <div>
      <h1>メール一覧</h1>
      {mails.map((mail, i) => (
        <div key={i}>{mail.subject}</div>
      ))}
    </div>
  );
}