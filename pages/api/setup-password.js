// 初回パスワード設定API (/api/setup-password)
// まだpassword_hash/saltが設定されていない管理者に対してのみ、強度チェック済みの
// パスワードからハッシュを生成し初期設定する(設定済みの場合は403で拒否)
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import crypto from "crypto";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method Not Allowed",
    });
  }

  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      error: "メールアドレスとパスワードが必要です",
    });
  }

  try {
    // admin取得
    const { data, error: fetchError } = await supabaseAdmin
      .from("admins")
      .select("user_email, password_hash, salt")
      .eq("user_email", email.trim())
      .single();

    if (fetchError || !data) {
      return res.status(404).json({
        error: "ユーザーが見つかりません",
      });
    }

    // 既に設定済み(初回設定専用のAPIのため、再設定はreset-password.jsを使わせる)
    if (data.password_hash && data.salt) {
      return res.status(403).json({
        error: "既に設定済みです",
      });
    }

    // 強度チェック(英小文字・英大文字・数字を各1文字以上含む8文字以上)
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d]{8,}$/.test(password)) {
      return res.status(400).json({
        error: "パスワード要件を満たしていません",
      });
    }

    // hash生成(salt付きpbkdf2でハッシュ化し、平文パスワードは保存しない)
    const salt = crypto.randomBytes(16).toString("hex");

    const passwordHash = crypto
      .pbkdf2Sync(password, salt, 100000, 64, "sha512")
      .toString("hex");

    // 保存
    const { error } = await supabaseAdmin
      .from("admins")
      .update({
        password_hash: passwordHash,
        salt,
      })
      .eq("user_email", email.trim());

    if (error) {
      return res.status(500).json({
        error: "保存に失敗しました",
      });
    }

    return res.status(200).json({
      success: true,
    });
  } catch (err) {
    // 想定外のエラーはログに出しつつ500を返す
    console.error(err);

    return res.status(500).json({
      error: "SERVER_ERROR",
    });
  }
}
