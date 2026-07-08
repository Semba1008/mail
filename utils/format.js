export const LINK_STYLE = { color: "#3182ce", textDecoration: "underline" };

// 都道府県名の揺らぎを吸収するための正規化関数
export const normalize = (name) => name?.replace(/(都|道|府|県)$/, "") || "";

// HTMLエンティティをデコードする関数
export const decodeHtml = (html) => {
  if (typeof window === "undefined") return html;
  const textarea = document.createElement("textarea");
  textarea.innerHTML = html;
  return textarea.value;
};

// テキスト内のURLやメールアドレスをリンクに変換する関数
// 改善案：Base64/HTMLデコードをスキップし、純粋なリンク化のみを行う
export const formatContent = (text) => {
  try {
    const linkRegex = /(https?:\/\/[^\s<>"']+|[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,})/g;
    return text.split(linkRegex).map((part, index) => {
      // リンク化の処理はそのまま維持
      if (/^https?:\/\//.test(part)) {
        return (
          <a
            key={`${part}-${index}`}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            style={LINK_STYLE}
          >
            {part}
          </a>
        );
      }
      if (/^[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}$/.test(part)) {
        return (
          <a
            key={`${part}-${index}`}
            href={`mailto:${part}`}
            style={LINK_STYLE}
          >
            {part}
          </a>
        );
      }
      return part;
    });
  } catch {
    return text;
  }
};

// 募集人数を抽出する関数
export const extractRecruitment = (content = "") => {
  const match = content.match(/([0-9０-９]+|複数|若干)名(以上)?/);
  return match?.[0] || "記載なし";
};
