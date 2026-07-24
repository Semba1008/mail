import { useState } from "react";
import { useRouter } from "next/router";

// ログイン画面 (/login)
// メールアドレス・パスワードを入力して /api/login にPOSTし、
// 成功時はトップページへ遷移する。初回ログイン・パスワード再設定への導線もここに置く
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  // ログイン処理
  const handleLogin = async () => {
    // 二重送信防止(ボタン連打などでリクエストが重複しないようガード)
    if (loading) return;
    setErrorMessage("");

    // 未入力チェック(本来はどちらか一方だけ未入力の場合も弾きたいが、
    // 現状は両方とも空のケースのみ判定している点に注意)
    if (!email && !password) {
      setErrorMessage("メールアドレスとパスワードを入力してください");
      return;
    }

    try {
      setLoading(true);

      // 認証APIへログイン情報を送信。Cookie(セッション)をやり取りするため credentials: "include"
      const res = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
        credentials: "include",
      });

      let result = null;

      // レスポンスがJSONの場合のみパースする(エラーページなどHTMLが返るケースを考慮)
      if (res.headers.get("content-type")?.includes("application/json")) {
        result = await res.json().catch(() => null);
      }
      if (!res.ok) {
        // サーバー側から返るエラーコードに応じてメッセージを出し分け
        switch (result?.error) {
          case "NOT_ADMIN":
            setErrorMessage("管理者ではありません");
            break;

          case "NO_PASSWORD":
            setErrorMessage("初回ログインをしてください");
            break;

          case "INVALID_PASSWORD":
            setErrorMessage("パスワードが一致しません");
            break;

          default:
            setErrorMessage("ログインに失敗しました");
        }

        return;
      }

      // ログイン成功。トップページへ遷移
      router.push("/");
    } catch (error) {
      console.error(error);

      const message =
        error instanceof Error ? error.message : "ログインに失敗しました";

      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>案件配信メール　ログイン画面</h1>

        <input
          type="email"
          placeholder="メールアドレス"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={styles.input}
        />
        <input
          type="password"
          placeholder="パスワード"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={styles.input}
        />

        {errorMessage && <div style={styles.error}>{errorMessage}</div>}

        {/* ログイン中、またはメール・パスワードいずれか未入力の間はボタンを無効化 */}
        <button
          onClick={handleLogin}
          disabled={loading || !email.trim() || !password}
          style={{
            ...styles.button,
            opacity: loading || !email.trim() || !password ? 0.7 : 1,
            cursor:
              loading || !email.trim() || !password ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "ログイン中..." : "ログイン"}
        </button>
        <div style={{ textAlign: "center", marginTop: 12 }}>
          <a
            href="/setup-password"
            style={{
              fontSize: "0.85rem",
              color: "#3182ce",
              textDecoration: "underline",
            }}
          >
            初回ログインの方はこちら
          </a>
        </div>
        <div style={{ textAlign: "center", marginTop: 12 }}>
          <a
            href="/reset-password"
            style={{
              fontSize: "0.85rem",
              color: "#3182ce",
              textDecoration: "underline",
            }}
          >
            パスワードを忘れた方はこちら
          </a>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    backgroundColor: "#f7fafc",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    fontFamily: "sans-serif",
  },

  card: {
    width: "100%",
    maxWidth: 500,
    backgroundColor: "#fff",
    padding: 30,
    borderRadius: 12,
    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },

  title: {
    margin: 0,
    textAlign: "center",
    color: "#1a365d",
  },

  input: {
    padding: 12,
    borderRadius: 8,
    border: "1px solid #cbd5e0",
    fontSize: "1rem",
  },

  button: {
    padding: 12,
    borderRadius: 8,
    border: "none",
    backgroundColor: "#1a365d",
    color: "#fff",
    fontWeight: "bold",
    fontSize: "1rem",
  },

  error: {
    color: "#e53e3e",
    fontSize: "0.9rem",
  },
};
