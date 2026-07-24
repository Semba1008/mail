import { createClient } from '@supabase/supabase-js'

// クライアント側(ブラウザ)で使うSupabaseクライアント。匿名キーを使用するため権限は限定的
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

)

