import { useMemo } from "react";
import { styles } from "../styles/index.styles";
import { extractRecruitment } from "../utils/format";
import { getProjectCategories } from "../utils/project";

// 案件一覧に並ぶ1件分のカードを表示するコンポーネント
// project: 表示対象の案件データ(タイトル・単価・期間・添付ファイル等)
// readIds/appliedIds: 既読/応募済みの案件IDリスト(呼び出し元の状態を基に判定に使う)
// viewMode: 現在の一覧の種類("applied"など)。応募済みバッジの出し分けに使用
// toggleFavorite/toggleApplied: お気に入り・応募済みフラグの切り替えハンドラ
// openProject: 案件詳細を開くハンドラ
// handleSendEmail: 案件宛のメール作成を開始するハンドラ
// setDeleteTargetId: 削除確認モーダルを出すため、削除対象IDをセットする関数
export const ProjectCard = ({
  project,
  readIds,
  appliedIds,
  viewMode,
  toggleFavorite,
  toggleApplied,
  openProject,
  handleSendEmail,
  setDeleteTargetId,
}) => {
  const isRead = readIds.includes(project.id);
  const isApplied = appliedIds.includes(project.id);
  const projectCategories = getProjectCategories(project);

  // useMemoはここでOK（コンポーネントが安定した後）
  // project.attachmentsはDBの保存形式によって配列/JSON文字列どちらの場合もあるため、
  // ここで正規化して配列に統一する(不正な値はパース失敗として扱い空配列にフォールバック)
  const attachments = useMemo(() => {
    if (!project.attachments) return [];
    if (Array.isArray(project.attachments)) return project.attachments;

    try {
      return JSON.parse(project.attachments);
    } catch {
      return [];
    }
  }, [project.attachments]);

  return (
    <div style={{ ...styles.card, opacity: project.isClosed ? 0.7 : 1 }}>
      <div style={{ fontSize: "0.7rem", color: "#a0aec0", marginBottom: 5 }}>
        ID: {project.id}
      </div>
      {/* 右上に状態バッジ(募集停止/まもなく終了/応募済み/既読)とお気に入りボタンをまとめて表示 */}
      <div
        style={{
          position: "absolute",
          top: 15,
          right: 15,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        {project.isClosed && (
          <span style={{ ...styles.badge, backgroundColor: "#e53e3e" }}>
            募集停止
          </span>
        )}
        {project.isExpiringSoon && !project.isClosed && (
          <span style={{ ...styles.badge, backgroundColor: "#dd6b20" }}>
            まもなく終了
          </span>
        )}
        {/* 「応募済み」一覧を表示している時は自明なのでバッジを重複表示しない */}
        {isApplied && viewMode !== "applied" && (
          <span style={{ ...styles.badge, backgroundColor: "#48bb78" }}>
            応募済み
          </span>
        )}
        {isRead && (
          <span
            style={{
              ...styles.badge,
              backgroundColor: "#e2e8f0",
              color: "#4a5568",
            }}
          >
            既読
          </span>
        )}
        {/* お気に入りの星ボタン。クリックがカード全体のクリックへ伝播しないようイベントを渡す */}
        <button
          onClick={(e) => toggleFavorite(e, project.id)}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: "1.4rem",
            color: project.favorite ? "#ed8936" : "#cbd5e0",
            padding: 0,
          }}
        >
          {project.favorite ? "★" : "☆"}
        </button>
      </div>
      <h3
        style={{
          fontSize: "1rem",
          color: "#1a365d",
          marginBottom: 20,
          fontWeight: 700,
          paddingRight: 60,
          textDecoration: project.isClosed ? "line-through" : "none",
        }}
      >
        {project.title}
      </h3>
      {/* 場所・単価・期間などの主要項目をラベルと値のペアで一覧表示 */}
      <div style={{ fontSize: "0.85rem", flexGrow: 1 }}>
        {[
          ["場所", project.location || "記載なし"],
          ["単価", project.price || "記載なし"],
          ["期間", project.period || "記載なし"],
          ["募集期間", project.end_date || "記載なし"],
          ["募集人数", extractRecruitment(project.content)],
        ].map(([label, value]) => (
          <div
            key={label}
            style={{
              display: "flex",
              marginBottom: label === "募集人数" ? 0 : 8,
            }}
          >
            <span style={{ fontWeight: "bold", minWidth: 80 }}>
              【{label}】
            </span>
            <span>{value}</span>
          </div>
        ))}

        {attachments.length > 0 && (
          <div
            style={{
              marginTop: 12,
              fontSize: "0.8rem",
              color: "#4a5568",
              fontWeight: "bold",
              backgroundColor: "#edf2f7",
              padding: "4px 8px",
              borderRadius: 4,
              display: "inline-block",
            }}
          >
            📎 添付ファイルあり ({attachments.length})
          </div>
        )}
      </div>
      {/* カード下部の操作ボタン群(詳細/メール作成/応募済み切り替え/削除) */}
      <div
        style={{ display: "flex", gap: 8, marginTop: 20, flexWrap: "wrap" }}
      >
        <button
          onClick={() => openProject(project)}
          style={{ ...styles.primaryButton, flex: "1 1 calc(50% - 4px)" }}
        >
          詳細
        </button>
        {/* 募集停止中の案件へは新規メール作成させない */}
        <button
          onClick={(e) => handleSendEmail(e, project)}
          disabled={project.isClosed}
          style={{
            ...styles.secondaryButton,
            flex: "1 1 calc(50% - 4px)",
            cursor: project.isClosed ? "not-allowed" : "pointer",
            opacity: project.isClosed ? 0.5 : 1,
          }}
        >
          メール作成
        </button>
        {/* 応募済み/未応募をトグルするボタン。見た目と文言を状態に応じて切り替える。
            募集停止中の案件へは新規応募できないため無効化する(お気に入りは募集停止後も
            管理用途で使えるよう無効化しない) */}
        <button
          onClick={(e) => toggleApplied(e, project.id)}
          disabled={project.isClosed}
          style={{
            flex: "1 1 100%",
            padding: 8,
            borderRadius: 6,
            border: "1px solid #cbd5e0",
            background: isApplied ? "#e6fffa" : "#fff",
            color: isApplied ? "#38a169" : "#4a5568",
            cursor: project.isClosed ? "not-allowed" : "pointer",
            fontWeight: "bold",
            opacity: project.isClosed ? 0.5 : 1,
          }}
        >
          {isApplied ? "応募解除" : "応募済みにする"}
        </button>
        {/* 削除ボタン。即削除はせず、削除対象IDをセットして確認モーダル側で処理させる */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setDeleteTargetId(project.projects_id);
          }}
          style={{
            width: "100%",
            padding: 6,
            borderRadius: 6,
            border: "1px solid #fc8181",
            color: "#e53e3e",
            background: "#fff",
            cursor: "pointer",
            fontSize: "0.75rem",
          }}
        >
          削除
        </button>
      </div>
    </div>
  );
};
