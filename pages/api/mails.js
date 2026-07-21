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
    // DELETE
    // =========================
    if (req.method === "DELETE") {
      const id = req.query?.id;

      if (!id || typeof id !== "string") {
        return res.status(400).json({ error: "IDが無効です" });
      }

      const { data: attachments } = await supabaseAdmin
        .from("attachments")
        .select("file_url")
        .eq("attachments_id", id);

      if (attachments?.length > 0) {
        const fileNames = attachments
          .map((f) => {
            try {
              return new URL(f.file_url).pathname.split("/FILES/")[1];
            } catch {
              return null;
            }
          })
          .filter(Boolean);

        if (fileNames.length > 0) {
          await supabaseAdmin.storage.from("FILES").remove(fileNames);
        }
      }

      await supabaseAdmin
        .from("attachments")
        .delete()
        .eq("attachments_id", id);

      await supabaseAdmin
        .from("projects")
        .delete()
        .eq("projects_id", id);

      return res.status(200).json({ message: "削除成功" });
    }
    // =========================
    // GET
    // =========================
    if (req.method === "GET") {
      
      // ④ データ取得
      const page = Number(req.query?.page || 0);
      const pageSize = 1000;

      const { data, error, count } = await supabaseAdmin
        .from("projects")
        .select(`
          *,
          attachments (
            id,
            file_name,
            file_url
          )
        `, { count: "exact" })
        .order("created_at", { ascending: false })
        .range(page * pageSize, page * pageSize + pageSize - 1);

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      return res.status(200).json({ data, total: count, pageSize });
    }

    return res.status(405).json({ error: "Method Not Allowed" });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
}