// ローカルストレージのラッパー
// SSR時(windowが存在しない)や不正なJSONが保存されている場合でも
// 例外を投げずに配列を扱えるようにするための薄いラッパー
export const storage = {
  // 保存値をJSONとして読み出す。未設定/パース失敗時は空配列を返す
  get(key) {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(localStorage.getItem(key) || "[]");
    } catch {
      return [];
    }
  },
  // 値をJSON文字列化して保存する
  set(key, value) {
    if (typeof window !== "undefined") {
      localStorage.setItem(key, JSON.stringify(value));
    }
  },
};
