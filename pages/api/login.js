// 管理者ログインAPI (/api/login)
// email/passwordを受け取り、pbkdf2ハッシュ照合に成功したら新規セッションを発行しCookieにセットする
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import crypto from "crypto";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      status: "error",
      error: "Method Not Allowed",
    });
  }

  const { email, password } = req.body;



  try {
    // ユーザー取得
    const { data, error } = await supabaseAdmin
      .from("admins")
      .select("user_email, password_hash, salt")
      .eq("user_email", email.trim())
      .single();

    if (error || !data) {
      return res.status(401).json({
        status: "error",
        error: "NOT_ADMIN",
      });
    }

    // 初回ログイン判定(パスワード未設定=初回ログインとしてセットアップ画面に誘導するため)
    if (!data.password_hash || !data.salt) {
      return res.status(401).json({
    status: "error",
    error: "NO_PASSWORD",
      });
    }

    // password hash生成(登録時と同じsalt・パラメータで再計算し照合する)
    const inputHash = crypto
      .pbkdf2Sync(password, data.salt, 100000, 64, "sha512")
      .toString("hex");


    let isMatch = false;

    try {
      // タイミング攻撃を避けるため timingSafeEqual で比較する
      isMatch = crypto.timingSafeEqual(
        Buffer.from(inputHash, "hex"),
        Buffer.from(data.password_hash, "hex")
      );
    } catch (e) {
      // バッファ長不一致などで比較自体が失敗した場合もパスワード不一致として扱う
      return res.status(401).json({
        status: "error",
        error: "INVALID_PASSWORD",
      });
    }

    if (!isMatch) {
      return res.status(401).json({
        status: "error",
        error: "INVALID_PASSWORD",
      });
    }

    // 既存セッション削除(同一Cookieに紐づく古いセッションを使い回さないようにする)
    const oldToken = req.cookies?.token;

    if (oldToken) {
      await supabaseAdmin.from("sessions").delete().eq("token", oldToken);
    }

    // 新規トークン発行
    const token = crypto.randomUUID();

    const { error: sessionError } = await supabaseAdmin
      .from("sessions")
      .insert({
        token,
        user_email: data.user_email,
      });

    if (sessionError) {
      return res.status(500).json({
        status: "error",
        error: "セッション作成に失敗しました",
      });
    }

    // cookie設定(HttpOnly + SameSite=Laxで保護し、本番環境のみSecure属性を付与)
    const isProd = process.env.NODE_ENV === "production";

    res.setHeader(
      "Set-Cookie",
      `token=${token}; Path=/; HttpOnly; SameSite=Lax; ${
        isProd ? "Secure;" : ""
      } Max-Age=${60 * 60 * 24 * 7}`
    );

    // 成功
    return res.status(200).json({
      status: "success",
      email: data.user_email,
    });
  } catch (err) {
    // 想定外のエラーはログに出しつつ500を返す
    console.error("LOGIN ERROR:", err);

    return res.status(500).json({
      status: "error",
      error: "サーバーエラー",
    });
  }

  
}