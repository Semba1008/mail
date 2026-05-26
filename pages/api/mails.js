import { supabase } from '../../lib/supabase'
 
export default async function handler(req, res) {
  // --- 削除処理 (DELETE) ---
  if (req.method === 'DELETE') {
    const { id } = req.query; // 画面からは ID だけ送ればOK！
 
    if (!id) {
      return res.status(400).json({ error: 'ID is required' });
    }
 
    try {
      // 1. データベースから、これから削除する案件の attachment_url を取得する
      const { data: project, error: fetchError } = await supabase
        .from('projects')
        .select('attachment_url')
        .eq('id', id)
        .single();
 
      if (fetchError) {
        return res.status(500).json({ error: `案件の取得に失敗: ${fetchError.message}` });
      }
 
      // 2. attachment_url が存在する場合、そこからファイル名を抜き出してストレージから削除
      if (project && project.attachment_url) {
        // URLの最後にあるファイル名部分（例: "photo.jpg"）だけを抽出します
        // ※ もし複数ファイルがカンマ区切り等で入っている場合は、URLを分解する処理が必要です
        const urlParts = project.attachment_url.split('/');
        const fileName = urlParts[urlParts.length - 1];
 
        if (fileName) {
          const { error: storageError } = await supabase
            .storage
            .from('FILES') // バケット名
            .remove([fileName]);
 
          if (storageError) {
            console.error('ストレージのファイル削除に失敗しました:', storageError.message);
            // ストレージ削除に失敗しても、一応ログに残してDB削除へ進みます
          }
        }
      }
 
      // 3. データベースから案件レコードを削除
      const { error: deleteError } = await supabase
        .from('projects')
        .delete()
        .eq('id', id);
 
      if (deleteError) {
        return res.status(500).json({ error: deleteError.message });
      }
 
      return res.status(200).json({ message: '案件データと添付ファイルを一括削除しました' });
 
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }
 
  // GETリクエスト（既存の処理）
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('projects') 
      .select('*')
      .order('created_at', { ascending: false });
 
    if (error) {
      return res.status(500).json({ data: null, error: error.message });
    }
    return res.status(200).json({ data, error: null });
  }
 
  return res.status(405).json({ error: 'Method Not Allowed' });
}