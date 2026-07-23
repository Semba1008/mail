// メール本文の表示整形に関する共通ヘルパー関数群
// (都道府県名の正規化、HTMLデコード、URL/メールアドレスのリンク化、募集人数の抽出)

export const LINK_STYLE = { color: "#3182ce", textDecoration: "underline" };

// 都道府県名の揺らぎを吸収するための正規化関数
export const normalize = (name) => name?.replace(/(都|道|府|県)$/, "") || "";

// HTMLエンティティをデコードする関数
export const decodeHtml = (html) => {
  if (typeof window === "undefined") return html;
  // textareaのinnerHTMLに流し込みvalueとして読み出すことで、
  // ブラウザの標準デコーダーに任せて&amp;等のエンティティを実体化する
  const textarea = document.createElement("textarea");
  textarea.innerHTML = html;
  return textarea.value;
};

// テキスト内のURLやメールアドレスをリンクに変換する関数
// 改善案：Base64/HTMLデコードをスキップし、純粋なリンク化のみを行う
export const formatContent = (text) => {
  try {
    // 正規表現をキャプチャグループ付きでsplitに渡すと、マッチした部分も
    // 配列要素として結果に含まれる(区切り文字を残したまま分割できる)ため、
    // それを利用してURL/メールアドレス部分とそれ以外のテキスト部分を交互に得ている
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
// メール本文中の表記ゆれ(半角/全角数字、「複数」「若干」名など)に対応
export const extractRecruitment = (content = "") => {
  const match = content.match(/([0-9０-９]+|複数|若干)名(以上)?/);
  return match?.[0] || "記載なし";
};
