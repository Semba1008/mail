import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { normalize } from "../../utils/format";
import { regionalPrefectures } from "../../constants/regions";

function getToken(req) {
  return req.cookies?.token;
}

function toArray(value) {
  return [].concat(value || []).filter(Boolean);
}

// ILIKEワイルドカード(%, _, \)をエスケープする
function escapeLikeWildcards(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

// PostgRESTのor()ミニDSL区切り文字(, ( ))対策として、値をダブルクォートで囲む
function quoteForOrFilter(value) {
  const escaped = String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"${escaped}"`;
}

// 部分一致(%value%)のILIKEオペランドを、or()フィルタへ安全に埋め込める形で作る
// (ワイルドカード%/%_を含めた完成形のパターン全体をダブルクォートで囲む必要がある。
//  クォートを value 部分だけに付けて外側に%を置くと、%が引用符の外に出て構文が壊れるので注意)
function containsPattern(value) {
  return quoteForOrFilter(`%${escapeLikeWildcards(value)}%`);
}

// 前方一致(value%)のILIKEオペランドを同様に安全な形で作る
function startsWithPattern(value) {
  return quoteForOrFilter(`${escapeLikeWildcards(value)}%`);
}

// title/skills/content/locationのいずれかに部分一致するOR条件を組み立てる
function orAcrossColumns(value) {
  const pattern = containsPattern(value);
  return `title.ilike.${pattern},skills.ilike.${pattern},content.ilike.${pattern},location.ilike.${pattern}`;
}

const CATEGORY_KEYWORDS = { dev: "業務系", infra: "インフラ", embedded: "組み込み" };

async function handleListQuery(req, res) {
  const page = Math.max(1, Number(req.query?.page) || 1);
  const pageSize = Math.min(Number(req.query?.pageSize) || 24, 100);

  const q = (req.query?.q || "").trim();
  const region = req.query?.region || "";
  const prefs = toArray(req.query?.prefs);
  const skills = toArray(req.query?.skills);
  const categories = toArray(req.query?.categories);
  const remote = req.query?.remote === "1";
  const hideClosed = req.query?.hideClosed !== "0";
  const viewMode = req.query?.viewMode || "all";
  const appliedIds = toArray(req.query?.appliedIds).map(Number).filter(Number.isFinite);
  const ids = toArray(req.query?.ids).map(Number).filter(Number.isFinite);

  // 応募済み/お気に入り/閲覧履歴タブで、対象IDが0件なら問い合わせるまでもなく空
  if (viewMode === "applied" && appliedIds.length === 0) {
    return res.status(200).json({ data: [], total: 0 });
  }
  if ((viewMode === "favorites" || viewMode === "history") && ids.length === 0) {
    return res.status(200).json({ data: [], total: 0 });
  }

  let query = supabaseAdmin
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
      { count: "exact" }
    );

  if (hideClosed) {
    query = query.or("isClosed.eq.false,isClosed.is.null");
  }

  if (viewMode === "applied") {
    query = query.in("id", appliedIds);
  } else {
    if (appliedIds.length > 0) {
      query = query.not("id", "in", `(${appliedIds.join(",")})`);
    }
    if (viewMode === "favorites" || viewMode === "history") {
      query = query.in("id", ids);
    }
  }

  for (const cat of categories) {
    if (cat === "other") {
      query = query.or(
        "category.is.null,and(category.not.ilike.%業務系%,category.not.ilike.%インフラ%,category.not.ilike.%組み込み%)"
      );
    } else if (CATEGORY_KEYWORDS[cat]) {
      query = query.ilike("category", `%${CATEGORY_KEYWORDS[cat]}%`);
    }
  }

  if (viewMode === "all" && region && region !== "すべて") {
    const regionPrefs = regionalPrefectures.find((r) => r.region === region)?.prefs || [];
    if (regionPrefs.length > 0) {
      query = query.or(
        regionPrefs.map((p) => `location.ilike.${startsWithPattern(normalize(p))}`).join(",")
      );
    }
  }

  if (prefs.length > 0) {
    query = query.or(
      prefs.map((p) => `location.ilike.${startsWithPattern(normalize(p))}`).join(",")
    );
  }

  for (const skill of skills) {
    query = query.or(orAcrossColumns(skill));
  }

  if (remote) {
    query = query.or("location.ilike.%リモート%,title.ilike.%リモート%,content.ilike.%リモート%");
  }

  if (q) {
    query = query.or(orAcrossColumns(q));
  }

  query = query
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, (page - 1) * pageSize + pageSize - 1);

  const { data, count, error } = await query;

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ data, total: count ?? 0 });
}

// CSV自動書き出し用の軽量取得(content/attachmentsは含めない)
async function handleExportQuery(req, res) {
  const year = Number(req.query?.year);
  const month = req.query?.month ? Number(req.query?.month) : null;

  if (!Number.isFinite(year)) {
    return res.status(400).json({ error: "yearが不正です" });
  }

  const rangeStart = new Date(year, month != null ? month - 1 : 0, 1).toISOString();
  const rangeEnd = new Date(
    month != null ? year : year + 1,
    month != null ? month : 0,
    1
  ).toISOString();

  const { data, error } = await supabaseAdmin
    .from("projects")
    .select("id,title,category,location,price,period,end_date,skills,created_at")
    .gte("created_at", rangeStart)
    .lt("created_at", rangeEnd)
    .order("created_at", { ascending: false });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ data });
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
      if (req.query?.mode === "list") {
        return handleListQuery(req, res);
      }

      if (req.query?.mode === "export") {
        return handleExportQuery(req, res);
      }

      // ④ データ取得(レガシー: /stats 等が使う全件ループ用。挙動は変更しない)
      const page = Number(req.query?.page || 0);
      const pageSize = 1000;

      const { data, error } = await supabaseAdmin
        .from("projects")
        .select(`
          *,
          attachments (
            id,
            file_name,
            file_url
          )
        `)
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