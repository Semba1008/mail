import DOMPurify from "dompurify";

export const ContentDisplay = ({ content }) => {
  if (!content) return null;

  // 1. Base64かどうかを判定する関数
  const isBase64 = (str) => {
    if (typeof str !== "string") return false;
    // 「PG...」から始まるなど、HTMLメールがBase64化されているケースを考慮
    return /^[A-Za-z0-9+/]+={0,2}$/.test(str) && str.length > 50;
  };

  // 2. Base64ならデコードする
  let processedContent = content;
  if (isBase64(content)) {
    try {
      processedContent = atob(content);
    } catch (e) {
      console.error("Base64デコード失敗:", e);
    }
  }

  // 3. HTMLタグが含まれているか判定
  const isHtml = /<[a-z][\s\S]*>/i.test(processedContent);

  if (isHtml) {
    // 安全のためにHTMLをサニタイズして表示
    return (
      <div
        dangerouslySetInnerHTML={{
          __html: DOMPurify.sanitize(processedContent),
        }}
      />
    );
  }

  // 4. それ以外はただのテキストとして表示
  return <div style={{ whiteSpace: "pre-wrap" }}>{processedContent}</div>;
};
