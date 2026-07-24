import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

// 自動化処理の実行結果一覧を表示するページ (/automate-results)
// 結果表示コンポーネントはブラウザ専用ライブラリを使うため ssr: false で
// サーバーサイドレンダリングを無効化し、クライアント側でのみ読み込む
const AutomateResults = dynamic(() => import("../components/AutomateResults"), {
  ssr: false,
});

export default function AutomateResultsPage() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        // ログインチェック。未ログインならログイン画面へリダイレクト
        const me = await fetch("/api/me", { credentials: "include" });
        if (!me.ok) {
          window.location.href = "/login";
          return;
        }

        // /api/automate-results はページングAPIのため、
        // ページ番号をインクリメントしながら1000件ずつ取得し、全件揃うまでループする
        let allResults = [];
        let page = 0;
        let isFetching = true;

        while (isFetching) {
          const res = await fetch(`/api/automate-results?page=${page}`);
          const payload = await res.json();

          if (payload.error || !payload.data) break;

          allResults = [...allResults, ...payload.data];

          // 返却件数が1000件未満なら最終ページと判断してループ終了
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

  // 全件取得が完了するまでローディング表示
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

  // 取得した全件の実行結果を一覧表示コンポーネントに渡す
  return <AutomateResults results={results} />;
}
