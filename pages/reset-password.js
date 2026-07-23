import { useState } from "react";
import { useRouter } from "next/router";

// パスワード再設定画面 (/reset-password)
// メールアドレスと新しいパスワードを入力し、/api/reset-password で
// パスワードを更新する。setup-password.js とほぼ同じ画面構成だが、
// こちらは「パスワードを忘れた方」向けの再設定フロー用
export default function SetupPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSetupPassword = async () => {
    setErrorMessage("");

    // パスワードと確認用パスワードの一致チェック
    if (password !== confirmPassword) {
      setErrorMessage("パスワードが一致しません");
      return;
    }

    // パスワード要件チェック: 8文字以上・大文字/小文字/数字を各1文字以上含む
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d]{8,}$/.test(password)) {
      setErrorMessage("パスワード要件を満たしていません");
      return;
    }

    try {
      setLoading(true);

      // 再設定APIへ新パスワードを送信。Cookie(セッション)をやり取りするため credentials: "include"
      const res = await fetch("/api/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        setErrorMessage(result?.error ?? "エラーが発生しました");
        return;
      }

      // 設定成功。ログイン画面へ遷移(クエリでログイン画面に成功状態を伝える)
      router.push("/login?setup=success");
    } catch {
      setErrorMessage("設定に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={style.page}>
      <div style={style.card}>
        <h1 style={style.title}>パスワード再設定</h1>

        <input
          type="email"
          placeholder="メールアドレス"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={style.input}
        />

        <input
          type="password"
          placeholder="パスワード"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={style.input}
        />

        <input
          type="password"
          placeholder="パスワード確認"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          style={style.input}
        />

        {errorMessage && <p style={style.error}>{errorMessage}</p>}

        {/* 設定中、またはいずれかの入力欄が未入力の間はボタンを無効化 */}
        <button
          onClick={handleSetupPassword}
          disabled={loading || !email.trim() || !password || !confirmPassword}
          style={{
            ...style.button,
            opacity:
              loading || !email.trim() || !password || !confirmPassword
                ? 0.7
                : 1,
            cursor:
              loading || !email.trim() || !password || !confirmPassword
                ? "not-allowed"
                : "pointer",
          }}
        >
          {loading ? "設定中..." : "パスワード設定"}
        </button>
        {/* 入力中のパスワードが各要件を満たしているかをリアルタイムに表示 */}
        <p style={style.hint}>
          パスワード条件：
          <br />
          {password.length >= 8 ? "✅" : "❌"} 8文字以上
          <br />
          {/[A-Z]/.test(password) ? "✅" : "❌"} 大文字
          <br />
          {/[a-z]/.test(password) ? "✅" : "❌"} 小文字
          <br />
          {/\d/.test(password) ? "✅" : "❌"} 数字
        </p>
      </div>
    </div>
  );
}

const style = {
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
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
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

  hint: {
  fontSize: "0.85rem",
  color: "#718096",
  lineHeight: "1.5",
  marginTop: -8,
},
};
