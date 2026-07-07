// ローカルストレージのラッパー
export const storage = {
  get(key) {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(localStorage.getItem(key) || "[]");
    } catch {
      return [];
    }
  },
  set(key, value) {
    if (typeof window !== "undefined") {
      localStorage.setItem(key, JSON.stringify(value));
    }
  },
};
