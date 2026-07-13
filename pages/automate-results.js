import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

const AutomateResults = dynamic(() => import("../components/AutomateResults"), {
  ssr: false,
});

export default function AutomateResultsPage() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const me = await fetch("/api/me", { credentials: "include" });
        if (!me.ok) {
          window.location.href = "/login";
          return;
        }

        let allResults = [];
        let page = 0;
        let isFetching = true;

        while (isFetching) {
          const res = await fetch(`/api/automate-results?page=${page}`);
          const payload = await res.json();

          if (payload.error || !payload.data) break;

          allResults = [...allResults, ...payload.data];

          if (payload.data.length < 1000) {
            isFetching = false;
          } else {
            page += 1;
          }
        }

        setResults(allResults);
      } catch (error) {
        console.error("データ取得エラー:", error);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          color: "#718096",
        }}
      >
        読み込み中...
      </div>
    );
  }

  return <AutomateResults results={results} />;
}
