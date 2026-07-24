import { createClient } from '@supabase/supabase-js'

// サーバー側(API Routes)専用のSupabaseクライアント。
// サービスロールキーを使うためRLSを回避でき、全API Routesから利用される
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

