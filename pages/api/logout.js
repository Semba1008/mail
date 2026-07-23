// ログアウトAPI (/api/logout)
// Cookieのtokenに対応するセッションをDBから削除し、Cookie自体も無効化(Max-Age=0)する
import { supabaseAdmin } from "../../lib/supabaseAdmin";

export default async function handler(req, res) {
  const token = req.cookies?.token;

  if (token) {
    // セッションレコードを削除し、以後このtokenでは認証できないようにする
    await supabaseAdmin
      .from("sessions")
      .delete()
      .eq("token", token);
  }

  // ブラウザ側のCookieも即時失効させる
  res.setHeader(
    "Set-Cookie",
    "token=; HttpOnly; Path=/; Max-Age=0"
  );

  return res.status(200).json({ success: true });
}