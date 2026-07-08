import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

const ProjectStats = dynamic(() => import("../components/ProjectStats"), {
  ssr: false,
});

export default function StatsPage() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const me = await fetch("/api/me", { credentials: "include" });
        if (!me.ok) {
          window.location.href = "/login";
          return;
        }

        let allProjects = [];
        let page = 0;
        let isFetching = true;

        while (isFetching) {
          const res = await fetch(`/api/mails?page=${page}`);
          const payload = await res.json();

          if (payload.error || !payload.data) break;

          allProjects = [...allProjects, ...payload.data];

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

  return <ProjectStats projects={projects} />;
}
