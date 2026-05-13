import { supabase } from '../../lib/supabase'

export default async function handler(req, res) {
  // GETリクエストのみを許可するガード処理
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // image_574e36.png のスキーマに基づき 'projects' テーブルから取得
  const { data, error } = await supabase
    .from('projects') 
    .select('*')
    // サーバー側で作成日時(created_at)の降順にソートしてレスポンスを速くする
    .order('created_at', { ascending: false });

  if (error) {
    return res.status(500).json({ data: null, error: error.message });
  }

  // 正常レスポンス
  res.status(200).json({ data, error: null });
}