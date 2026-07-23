import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

// 統計グラフ表示用ページ (/stats)
// グラフ描画コンポーネントはブラウザ専用ライブラリを使うため ssr: false で
// サーバーサイドレンダリングを無効化し、クライアント側でのみ読み込む
const ProjectStats = dynamic(() => import("../components/ProjectStats"), {
  ssr: false,
});

export default function StatsPage() {
  const [projects, setProjects] = useState([]);
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

        // グラフ集計には全件のデータが必要なため、/api/mails (mode指定なし) を
        // ページ番号をインクリメントしながら1000件ずつ取得し続けるループ。
        // 一覧画面(mode=list)とは別経路で、グラフ集計に使う列だけを返す軽量APIを叩いている。
        let allProjects = [];
        let page = 0;
        let isFetching = true;

        while (isFetching) {
          const res = await fetch(`/api/mails?page=${page}`);
          const payload = await res.json();

          if (payload.error || !payload.data) break;

          allProjects = [...allProjects, ...payload.data];

          // 返却件数が1000件未満なら最終ページと判断してループ終了
          if (payload.data.length < 1000) {
            isFetching = false;
          } else {
            page += 1;
          }
        }

        setProjects(allProjects);
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

  // 取得した全案件データをグラフ集計コンポーネントに渡す
  return <ProjectStats projects={projects} />;
}
