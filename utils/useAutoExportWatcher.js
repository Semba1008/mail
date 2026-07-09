import { useEffect, useRef } from "react";
import {
  getAutoExportEnabled,
  getLastExportedMonth,
  getPreviousMonth,
  isAutoExportSupported,
  loadDirectoryHandle,
  monthKey,
  queryDirectoryPermission,
  setLastExportedMonth,
} from "./autoExport";
import { buildProjectsCsvBlob, filterProjectsByPeriod } from "./projectStats";

// 月またぎを取りこぼさないよう、タブを開いている間はこの間隔で再チェックする
const CHECK_INTERVAL_MS = 30 * 60 * 1000;

// 「自動書き出し設定」が有効な場合、前月分のCSVがまだ書き出されていなければ
// 保存先フォルダへ自動で書き出す。ページを開いた瞬間と、開いたままの間は
// 30分おきに再チェックすることで、日付が変わって月が切り替わった瞬間も
// (タブを閉じていない限り)取りこぼさないようにする。
export function useAutoExportWatcher(projects, { onResult } = {}) {
  const projectsRef = useRef(projects);
  projectsRef.current = projects;

  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  const checkRef = useRef(async () => {});

  useEffect(() => {
    if (!isAutoExportSupported()) return undefined;

    let cancelled = false;

    const check = async () => {
      if (cancelled || !getAutoExportEnabled()) return;

      const handle = await loadDirectoryHandle().catch(() => null);
      if (!handle || cancelled) return;

      const { year, month } = getPreviousMonth();
      const key = monthKey(year, month);
      if (getLastExportedMonth() === key) return;

      const granted = await queryDirectoryPermission(handle).catch(() => false);
      if (cancelled) return;
      if (!granted) {
        onResultRef.current?.({ type: "needs-reauth" });
        return;
      }

      const targetProjects = filterProjectsByPeriod(projectsRef.current, year, month);
      const blob = buildProjectsCsvBlob(targetProjects);
      const filename = `案件一覧_自動_${year}年${month}月.csv`;

      try {
        const fileHandle = await handle.getFileHandle(filename, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();

        setLastExportedMonth(key);
        onResultRef.current?.({
          type: "success",
          message: `前月(${year}年${month}月)分の案件データ(${targetProjects.length}件)を「${handle.name}」フォルダにCSVで自動保存しました。`,
        });
      } catch (error) {
        console.error("自動書き出しエラー:", error);
        onResultRef.current?.({
          type: "error",
          message: "自動書き出しに失敗しました。保存先フォルダの権限や空き容量を確認してください。",
        });
      }
    };

    checkRef.current = check;
    check();
    const interval = setInterval(check, CHECK_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return { runCheckNow: () => checkRef.current() };
}
