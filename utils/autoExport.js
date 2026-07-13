// CSV自動書き出し(前月分)の設定・状態を管理するユーティリティ。
// 保存先フォルダのハンドルはFile System Access API経由で取得し、IndexedDBに保持する。
const DB_NAME = "mailapp-auto-export";
const STORE_NAME = "handles";
const HANDLE_KEY = "csvExportDir";

const ENABLED_KEY = "autoExportEnabled";
const LAST_MONTH_KEY = "autoExportLastMonth";

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveDirectoryHandle(handle) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(handle, HANDLE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearDirectoryHandle() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(HANDLE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadDirectoryHandle() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(HANDLE_KEY);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function queryDirectoryPermission(handle) {
  return (await handle.queryPermission({ mode: "readwrite" })) === "granted";
}

export async function requestDirectoryPermission(handle) {
  return (await handle.requestPermission({ mode: "readwrite" })) === "granted";
}

export const isAutoExportSupported = () =>
  typeof window !== "undefined" && "showDirectoryPicker" in window;

export const getAutoExportEnabled = () =>
  typeof window !== "undefined" && localStorage.getItem(ENABLED_KEY) === "true";

export const setAutoExportEnabled = (value) => {
  if (typeof window !== "undefined") {
    localStorage.setItem(ENABLED_KEY, value ? "true" : "false");
  }
};

export const monthKey = (year, month) => `${year}-${String(month).padStart(2, "0")}`;

export const getLastExportedMonth = () =>
  typeof window !== "undefined" ? localStorage.getItem(LAST_MONTH_KEY) : null;

export const setLastExportedMonth = (key) => {
  if (typeof window !== "undefined") {
    localStorage.setItem(LAST_MONTH_KEY, key);
  }
};

// 基準日から見た「前月」の年月を返す
export function getPreviousMonth(baseDate = new Date()) {
  const prev = new Date(baseDate.getFullYear(), baseDate.getMonth() - 1, 1);
  return { year: prev.getFullYear(), month: prev.getMonth() + 1 };
}
