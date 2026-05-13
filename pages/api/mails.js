import { supabase } from '@/lib/supabase'

export default async function handler(req, res) {
  try {
    // Supabaseからデータを取得する設定に切り替え
    const { data, error } = await supabase
      .from('projects') 
      .select('*')

    if (error) throw error
    
    // 取得した本番データを返す
    return res.status(200).json(data)
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
}
