// ログインユーザー確認API (/api/me)
// Cookieのtokenからセッション・管理者情報を引き、ログイン中のメールアドレスと
// 初回ログイン(パスワード未設定)かどうかをクライアントに返す
import { supabaseAdmin } from "../../lib/supabaseAdmin";

export default async function handler(req, res) {
  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).json({ error: "NO_SESSION" });
  }

  // tokenに対応するセッションが存在するか確認
  const { data } = await supabaseAdmin
    .from("sessions")
    .select("user_email")
    .eq("token", token)
    .single();

  if (!data) {
    return res.status(401).json({ error: "INVALID_SESSION" });
  }

  // パスワード設定状況を見て初回ログインかどうかを判定するために管理者情報を取得
  const { data: admin } = await supabaseAdmin
    .from("admins")
    .select("password_hash")
    .eq("user_email", data.user_email)
    .single();

  return res.status(200).json({
    email: data.user_email,
    firstLogin: !admin?.password_hash,
  });
}