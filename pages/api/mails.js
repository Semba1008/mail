import { supabase } from '../../lib/supabase';

export default async function handler(req, res) {
  // ==========================================
  // DELETE (プロジェクトおよび紐づく添付ファイルの削除)
  // ==========================================
  if (req.method === 'DELETE') {
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({ error: 'IDは必須です' });
    }

    try {
      // 1. 新しいテーブル構造に合わせて、projects_id に紐づく file_path (またはfile_url) を取得
      const { data: attachments, error: fetchError } = await supabase
        .from('attachments')
        .select('file_path') // カラム名に合わせてfile_pathを指定 (file_urlの場合は書き換えてください)
        .eq('projects_id', id);

      if (fetchError) {
        console.warn('attachmentsテーブルの取得をスキップしました:', fetchError.message);
      } else if (attachments && attachments.length > 0) {
        // 2. 紐づくファイルがストレージにあれば一括削除
        const fileNames = attachments.map(file => {
          if (!file.file_path) return null;
          // フルパスやURLからファイル名（またはストレージ内パス）部分を抽出
          const urlParts = file.file_path.split('/');
          return urlParts[urlParts.length - 1];
        }).filter(Boolean);

        if (fileNames.length > 0) {
          const { error: storageError } = await supabase
            .storage
            .from('FILES')
            .remove(fileNames);

          if (storageError) {
            console.error('Storage deletion failed:', storageError);
          }
        }
      }

      // 3. プロジェクト本体を削除 (CASCADE設定がない場合でも、これで安全に削除)
      const { error: projectDeleteError } = await supabase
        .from('projects')
        .delete()
        .eq('id', id);

      if (projectDeleteError) throw projectDeleteError;

      return res.status(200).json({ message: '削除成功' });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: err.message });
    }
  }

  // ==========================================
  // GET (プロジェクトと添付ファイル一覧の結合取得)
  // ==========================================
  if (req.method === 'GET') {
    try {
      // 実際のテーブルのカラム名 (id, file_name, file_path) に合わせて取得
      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          attachments (
            id,
            file_name,
            file_path
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        return res.status(500).json({ data: null, error: error.message });
      }

      return res.status(200).json({ data, error: null });
    } catch (err) {
      return res.status(500).json({ data: null, error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}