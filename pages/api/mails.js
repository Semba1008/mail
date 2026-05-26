import { supabase } from '../../../lib/supabase';

export default async function handler(req, res) {
  // =========================
  // DELETE (削除処理)
  // =========================
  if (req.method === 'DELETE') {
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({ error: 'IDは必須です' });
    }

    try {
      // 1. 関連するファイル名をストレージから削除するために、まずデータを取得
      const { data: attachments, error: fetchError } = await supabase
        .from('attachments')
        .select('url')
        .eq('project_id', id);

      if (fetchError) throw fetchError;

      // 2. 紐づくファイルがストレージにあれば削除
      if (attachments && attachments.length > 0) {
        const fileNames = attachments.map(file => {
          const urlParts = file.url.split('/');
          return urlParts[urlParts.length - 1];
        });

        const { error: storageError } = await supabase
          .storage
          .from('FILES')
          .remove(fileNames);

        // ※ストレージ削除エラーが発生しても、プロジェクト削除を続行するかは要件によります
        if (storageError) {
          console.error('Storage deletion failed:', storageError);
        }
      }

      // 3. プロジェクトを削除
      // データベース側で ON DELETE CASCADE が設定されていれば、
      // 紐づく attachments テーブルのレコードも自動的に削除されます。
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

  // =========================
  // GET (取得処理)
  // =========================
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