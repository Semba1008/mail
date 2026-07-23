// 対応ブラウザ（Chrome/Edge等）では保存先を選べるダイアログを表示し、
// 未対応ブラウザ（Firefox/Safari等）では従来通りダウンロードフォルダに自動保存する
export async function saveFile(blob, suggestedName, { types } = {}) {
  if (typeof window !== "undefined" && "showSaveFilePicker" in window) {
    try {
      const handle = await window.showSaveFilePicker({ suggestedName, types });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (error) {
      if (error?.name === "AbortError") return; // ユーザーがキャンセル
      console.error("ファイル保存エラー:", error);
    }
  }

  // showSaveFilePicker非対応環境向けフォールバック:
  // Blobから一時URLを生成し、非表示のaタグをクリックさせることでダウンロードを発火させる
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = suggestedName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}
