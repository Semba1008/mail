// パスワードリセットAPI (/api/reset-password)
// 管理者の存在確認のみ行い、新しいsalt・pbkdf2ハッシュを生成してpassword_hash/saltを上書きする
// (setup-password.jsと違い「既に設定済みかどうか」は問わず、強制的に再設定する用途)
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import crypto from "crypto";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method Not Allowed",
    });
  }

  const { email, password } = req.body;

  // 対象メールアドレスが管理者テーブルに存在するか確認
  const { data } = await supabaseAdmin
    .from("admins")
    .select("user_email")
    .eq("user_email", email.trim())
    .single();

  if (!data) {
    return res.status(404).json({
      error: "管理者が見つかりません",
    });
  }

  // 新しいsaltでパスワードハッシュを再生成
  const salt = crypto.randomBytes(16).toString("hex");

  const passwordHash = crypto
    .pbkdf2Sync(password, salt, 100000, 64, "sha512")
    .toString("hex");

  // password_hash/saltを新しい値で上書き保存
  const { error } = await supabaseAdmin
    .from("admins")
    .update({
      password_hash: passwordHash,
      salt: salt,
    })
    .eq("user_email", email.trim());

  if (error) {
    return res.status(500).json({
      error: "更新に失敗しました",
    });
  }

  return res.status(200).json({
    success: true,
  });
}