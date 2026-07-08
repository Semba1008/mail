import { styles } from "../styles/index.styles";

export const Pagination = ({
  currentPage,
  totalPages,
  paginationRange,
  changePage,
  style,
}) => {
  if (totalPages <= 1) return null;

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        gap: 8,
        marginTop: 20,
        flexWrap: "wrap",
        ...style,
      }}
    >
      {/* 最初のページへ一気に戻る */}
      <button
        onClick={() => changePage(1)}
        disabled={currentPage === 1}
        style={{
          ...styles.pageBtn,
          opacity: currentPage === 1 ? 0.5 : 1,
          cursor: currentPage === 1 ? "not-allowed" : "pointer",
        }}
      >
        最初のページ
      </button>

      {/* 5ページ前に戻る */}
      <button
        onClick={() => changePage(Math.max(currentPage - 5, 1))}
        disabled={currentPage === 1}
        style={{
          ...styles.pageBtn,
          opacity: currentPage === 1 ? 0.5 : 1,
          cursor: currentPage === 1 ? "not-allowed" : "pointer",
        }}
      >
        5ページ前へ
      </button>

      {/* 1ページ前に戻る */}
      <button
        onClick={() => changePage(Math.max(currentPage - 1, 1))}
        disabled={currentPage === 1}
        style={{
          ...styles.pageBtn,
          opacity: currentPage === 1 ? 0.5 : 1,
          cursor: currentPage === 1 ? "not-allowed" : "pointer",
        }}
        title="前へ"
      >
        ‹
      </button>

      {/* 通常のページ番号ボタン */}
      {paginationRange.map((page) => (
        <button
          key={page}
          onClick={() => typeof page === "number" && changePage(page)}
          style={{
            ...styles.pageBtn,
            backgroundColor: currentPage === page ? "#1a365d" : "#fff",
            color: currentPage === page ? "#fff" : "#2d3748",
          }}
        >
          {page}
        </button>
      ))}

      {/* 1ページ次に進む! */}
      <button
        onClick={() => changePage(Math.min(currentPage + 1, totalPages))}
        disabled={currentPage === totalPages}
        style={{
          ...styles.pageBtn,
          opacity: currentPage === totalPages ? 0.5 : 1,
          cursor: currentPage === totalPages ? "not-allowed" : "pointer",
        }}
        title="次へ"
      >
        ›
      </button>

      {/* 5ページ次に進む */}
      <button
        onClick={() => changePage(Math.min(currentPage + 5, totalPages))}
        disabled={currentPage === totalPages}
        style={{
          ...styles.pageBtn,
          opacity: currentPage === totalPages ? 0.5 : 1,
          cursor: currentPage === totalPages ? "not-allowed" : "pointer",
        }}
      >
        5ページ次へ
      </button>

      {/* 最後のページへ一気に飛ぶ */}
      <button
        onClick={() => changePage(totalPages)}
        disabled={currentPage === totalPages}
        style={{
          ...styles.pageBtn,
          opacity: currentPage === totalPages ? 0.5 : 1,
          cursor: currentPage === totalPages ? "not-allowed" : "pointer",
        }}
      >
        最終ページ
      </button>
    </div>
  );
};
