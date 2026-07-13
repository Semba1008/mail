import { supabaseAdmin } from "../../lib/supabaseAdmin";

function getToken(req) {
  return req.cookies?.token;
}

export default async function handler(req, res) {
  try {
    const token = getToken(req);

    if (!token) {
      return res.status(401).json({ error: "未ログイン" });
    }

    // =========================
    // セッション確認
    // =========================
    const { data: session, error: sessionError } = await supabaseAdmin
      .from("sessions")
      .select("user_email")
      .eq("token", token)
      .single();

    if (sessionError || !session) {
      return res.status(401).json({ error: "無効なセッション" });
    }

    const userEmail = session.user_email;

    // =========================
    // 管理者チェック
    // =========================
    const { data: admin, error: adminError } = await supabaseAdmin
      .from("admins")
      .select("id")
      .eq("user_email", userEmail)
      .single();

    if (adminError || !admin) {
      return res.status(403).json({ error: "権限なし" });
    }

    // =========================
    // GET
    // =========================
    if (req.method === "GET") {
      const page = Number(req.query?.page || 0);
      const pageSize = 1000;

      const { data, error } = await supabaseAdmin
        .from("results")
        .select("*")
        .order("created_at", { ascending: false })
        .range(page * pageSize, page * pageSize + pageSize - 1);

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      return res.status(200).json({ data });
    }

    return res.status(405).json({ error: "Method Not Allowed" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
}
