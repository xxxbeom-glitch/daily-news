/**
 * 로그인 (설정 > 로그인)
 */
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { getFirebaseAuth } from "../../lib/firebase";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { useFirebase } from "../context/FirebaseContext";

const sectionClass = "bg-white/5 border border-white/10 rounded-[10px] p-4 mb-4";
const labelClass = "text-white/80 text-sm mb-2 block";
const inputClass =
  "w-full px-4 py-3 rounded-[10px] border border-white/15 bg-white/5 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#618EFF]/50";

function getDisplayName(email: string | null | undefined, displayName: string | null | undefined): string {
  if (displayName?.trim()) return displayName.trim();
  if (email) {
    const local = email.split("@")[0]?.trim();
    if (local) return local;
  }
  return "박성범";
}

export function LoginPage() {
  const location = useLocation();
  const { user } = useFirebase();
  const isUnderSettings = location.pathname.startsWith("/settings/");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isLoggedIn = user && !user.isAnonymous;
  const displayName = getDisplayName(user?.email ?? null, user?.displayName ?? null);

  const handleLogin = async () => {
    const auth = getFirebaseAuth();
    if (!auth) {
      setError("Firebase가 설정되지 않았습니다. (.env에 Firebase 키 확인)");
      return;
    }
    if (!email.trim()) {
      setError("이메일을 입력하세요.");
      return;
    }
    if (!password) {
      setError("비밀번호를 입력하세요.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (e) {
      const err = e as { code?: string; message?: string };
      const code = err?.code ?? "";
      if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found") {
        setError("이메일 또는 비밀번호가 올바르지 않습니다.");
      } else if (code === "auth/invalid-email") {
        setError("이메일 형식이 올바르지 않습니다.");
      } else {
        setError(err?.message ?? "로그인에 실패했습니다.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="px-4 py-6">
      {isUnderSettings && (
        <Link
          to="/settings"
          className="flex items-center gap-1 text-white/70 hover:text-white mb-4"
          style={{ fontSize: 14 }}
        >
          <ChevronLeft size={18} />
          설정
        </Link>
      )}
      <h1 className="text-white font-bold mb-4" style={{ fontSize: 18 }}>
        로그인
      </h1>

      {isLoggedIn ? (
        <section className={sectionClass}>
          <p className="text-white text-base mb-4">{displayName}님 안녕하세요.</p>
          <button
            type="button"
            onClick={handleLogout}
            disabled={logoutLoading}
            className="w-full py-3 rounded-[10px] border border-white/20 bg-white/5 text-white/90 hover:bg-white/10 font-medium disabled:opacity-60 transition-colors"
            style={{ fontSize: 15 }}
          >
            {logoutLoading ? "로그아웃 중…" : "로그아웃"}
          </button>
        </section>
      ) : (
      <section className={sectionClass}>
        <label className={labelClass}>이메일</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="example@email.com"
          className={inputClass}
          autoComplete="email"
          disabled={loading}
        />
        <label className={`${labelClass} mt-3`}>비밀번호</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="비밀번호"
          className={inputClass}
          autoComplete="current-password"
          disabled={loading}
        />
        {error && (
          <p className="mt-2 text-red-400 text-sm">{error}</p>
        )}
        <button
          type="button"
          onClick={handleLogin}
          disabled={loading}
          className="mt-4 w-full py-3 rounded-[10px] bg-[#618EFF] hover:bg-[#618EFF]/90 text-white font-semibold disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          style={{ fontSize: 15 }}
        >
          {loading ? "로그인 중…" : "로그인"}
        </button>
      </section>
      )}
    </div>
  );
}
