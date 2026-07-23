// CSV自動書き出し(前月分)の設定・状態を管理するユーティリティ。
// 保存先フォルダのハンドルはFile System Access API経由で取得し、IndexedDBに保持する。
const DB_NAME = "mailapp-auto-export";
const STORE_NAME = "handles";
const HANDLE_KEY = "csvExportDir";

const ENABLED_KEY = "autoExportEnabled";
const LAST_MONTH_KEY = "autoExportLastMonth";

// IndexedDBのデータベースを開く（初回はオブジェクトストアを作成）
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

// 選択した保存先フォルダのハンドルをIndexedDBに保存する
export async function saveDirectoryHandle(handle) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(handle, HANDLE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// 保存先フォルダのハンドルをIndexedDBから削除する（自動書き出し設定の解除時に使用）
export async function clearDirectoryHandle() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(HANDLE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// 保存済みの保存先フォルダのハンドルを読み込む（未設定ならnull）
export async function loadDirectoryHandle() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(HANDLE_KEY);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

// 保存先フォルダへの書き込み権限が既に許可されているかを確認する（ダイアログは出さない）
export async function queryDirectoryPermission(handle) {
  return (await handle.queryPermission({ mode: "readwrite" })) === "granted";
}

// 保存先フォルダへの書き込み権限をユーザーに再度求める（ブラウザ再起動後などで失効した場合）
export async function requestDirectoryPermission(handle) {
  return (await handle.requestPermission({ mode: "readwrite" })) === "granted";
}

// File System Access APIに対応しているブラウザかどうか（Chrome/Edge等のみ対応）
export const isAutoExportSupported = () =>
  typeof window !== "undefined" && "showDirectoryPicker" in window;

// 自動書き出し設定がユーザーによって有効化されているか
export const getAutoExportEnabled = () =>
  typeof window !== "undefined" && localStorage.getItem(ENABLED_KEY) === "true";

// 自動書き出し設定の有効/無効を切り替える
export const setAutoExportEnabled = (value) => {
  if (typeof window !== "undefined") {
    localStorage.setItem(ENABLED_KEY, value ? "true" : "false");
  }
};

// 「年-月」形式のキー文字列を生成する（書き出し済み月の重複判定に使用）
export const monthKey = (year, month) => `${year}-${String(month).padStart(2, "0")}`;

// 最後に自動書き出しが行われた年月キーを取得する（未実施ならnull）
export const getLastExportedMonth = () =>
  typeof window !== "undefined" ? localStorage.getItem(LAST_MONTH_KEY) : null;

// 自動書き出しが完了した年月キーを記録し、同じ月に二重で書き出さないようにする
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
