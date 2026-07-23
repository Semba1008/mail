import { supabaseAdmin } from "./supabaseAdmin";

// リクエストのCookieに入っているtokenから、sessionsテーブルを引いて
// ログイン中のユーザーを特定するための認証ヘルパー
export async function auth(req) {
  const token = req.cookies?.token;

  // tokenが無ければ未ログイン扱い
  if (!token) {
    return { error: "NO_TOKEN" };
  }

  // tokenに紐づくセッションをDBから検索し、対応するユーザーのemailを取得
  const { data, error } = await supabaseAdmin
    .from("sessions")
    .select("user_email")
    .eq("token", token)
    .single();

  // セッションが見つからない(期限切れ・不正なtokenなど)場合はエラー
  if (error || !data) {
    return { error: "INVALID_SESSION" };
  }

  return {
    email: data.user_email,
  };
}