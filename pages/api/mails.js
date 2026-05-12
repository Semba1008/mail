import { supabase } from '../../lib/supabase'

export default async function handler(req, res) {
  // テーブル名を 'mails' から 'projects' に変更
  const { data, error } = await supabase
    .from('projects') 
    .select('*')

  res.status(200).json({ data, error })
}