import { supabaseAdmin } from "../../lib/supabaseAdmin";

function getToken(req) {
  return req.cookies?.token;
}

// 案件一覧は総件数分のページを並列で叩くため、同一トークンに対する
// セッション/管理者確認のDB往復が短時間に何度も発生する。
// 結果を数十秒キャッシュして往復回数を減らす(next startの常駐プロセス前提)。
const AUTH_CACHE_TTL_MS = 30_000;
const authCache = new Map();

async function verifyAdmin(token) {
  const cached = authCache.get(token);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.userEmail;
  }

  const { data: session, error: sessionError } = await supabaseAdmin
    .from("sessions")
    .select("user_email")
    .eq("token", token)
    .single();

  if (sessionError || !session) {
    authCache.set(token, { userEmail: null, expiresAt: Date.now() + AUTH_CACHE_TTL_MS });
    return null;
  }

  const { data: admin, error: adminError } = await supabaseAdmin
    .from("admins")
    .select("id")
    .eq("user_email", session.user_email)
    .single();

  if (adminError || !admin) {
    authCache.set(token, { userEmail: null, expiresAt: Date.now() + AUTH_CACHE_TTL_MS });
    return null;
  }

  authCache.set(token, { userEmail: session.user_email, expiresAt: Date.now() + AUTH_CACHE_TTL_MS });
  return session.user_email;
}

export default async function handler(req, res) {
  try {
    const token = getToken(req);

    if (!token) {
      return res.status(401).json({ error: "未ログイン" });
    }

    // =========================
    // セッション確認 + 管理者チェック(キャッシュ利用)
    // =========================
    const userEmail = await verifyAdmin(token);

    if (!userEmail) {
      return res.status(401).json({ error: "無効なセッション、または権限がありません" });
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
      // 総件数(count: "exact")はテーブル全体を数えるコストがかかるため、
      // ページ数の算出に使う1ページ目のリクエストでのみ計算する
      const { data, error, count } = await supabaseAdmin
        .from("projects")
        .select(
          `
          *,
          attachments (
            id,
            file_name,
            file_url
          )
        `,
          page === 0 ? { count: "exact" } : undefined,
        )
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