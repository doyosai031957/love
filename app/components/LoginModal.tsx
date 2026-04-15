"use client";

import { useState } from "react";

interface User {
  id: number;
  email: string;
  name: string;
}

interface LoginModalProps {
  onClose: () => void;
  onSuccess: (user: User) => void;
}

export default function LoginModal({ onClose, onSuccess }: LoginModalProps) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const reset = () => {
    setEmail("");
    setName("");
    setPassword("");
    setError("");
    setShowPassword(false);
  };

  const handleLogin = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        return;
      }
      const meRes = await fetch("/api/auth/me");
      const meData = await meRes.json();
      if (meRes.ok && meData.user) {
        onSuccess(meData.user);
      }
    } catch {
      setError("서버에 연결할 수 없습니다");
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        return;
      }
      const meRes = await fetch("/api/auth/me");
      const meData = await meRes.json();
      if (meRes.ok && meData.user) {
        onSuccess(meData.user);
      }
    } catch {
      setError("서버에 연결할 수 없습니다");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "login") {
      handleLogin();
    } else {
      handleSignup();
    }
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 200, background: "rgba(0, 0, 0, 0.5)" }}
      onClick={onClose}
    >
      <div
        className="relative w-full overflow-hidden"
        style={{
          maxWidth: 400,
          margin: "0 16px",
          background: "rgba(37, 37, 37, 0.15)",
          border: "1px solid rgba(255, 255, 255, 0.06)",
          backdropFilter: "blur(16px)",
          borderRadius: 20,
          padding: "48px 24px 32px",
          boxShadow:
            "0 0 8px rgba(0,0,0,0.03), 0 2px 6px rgba(0,0,0,0.08), inset 3px 3px 0.5px -3.5px rgba(255,255,255,0.09), inset -3px -3px 0.5px -3.5px rgba(255,255,255,0.85), inset 1px 1px 1px -0.5px rgba(255,255,255,0.6), inset -1px -1px 1px -0.5px rgba(255,255,255,0.6), inset 0 0 6px 6px rgba(255,255,255,0.12), inset 0 0 2px 2px rgba(255,255,255,0.06), 0 0 12px rgba(0,0,0,0.15)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Logo + Title */}
        <div className="flex items-center justify-center gap-3 mb-16">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <circle cx="20" cy="20" r="12" fill="rgba(255, 235, 170, 0.08)" />
            <circle cx="20" cy="20" r="8.5" fill="rgba(255, 235, 170, 0.35)" stroke="rgba(255, 235, 170, 0.9)" strokeWidth="1.5" />
            <path d="M12 21 Q20 17.5 28 21" stroke="rgba(255, 235, 170, 0.5)" strokeWidth="1" fill="none" />
            <ellipse cx="20" cy="20" rx="18" ry="7" stroke="rgba(255, 235, 170, 0.6)" strokeWidth="1.2" strokeDasharray="3.5 2.5" transform="rotate(-20 20 20)" />
            <circle cx="31" cy="8" r="4.5" fill="rgba(255, 235, 170, 0.3)" stroke="rgba(255, 235, 170, 0.85)" strokeWidth="1.2" />
            <circle cx="26.5" cy="13" r="2.2" fill="rgba(255, 235, 170, 0.25)" stroke="rgba(255, 235, 170, 0.65)" strokeWidth="1" />
            <circle cx="24" cy="15.5" r="1.1" fill="rgba(255, 235, 170, 0.6)" />
            <circle cx="4" cy="15" r="1.8" fill="rgba(255, 235, 170, 0.85)" />
            <circle cx="9" cy="33" r="1.2" fill="rgba(255, 235, 170, 0.55)" />
          </svg>
          <span
            className="font-bold text-[32px] tracking-[0.3px]"
            style={{ color: "white" }}
          >
            고민우주
          </span>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {/* Signup: name field */}
          {mode === "signup" && (
            <div
              className="flex items-center rounded-[10px] overflow-hidden"
              style={{
                background: "rgba(255, 255, 255, 0.06)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                height: 44,
              }}
            >
              <input
                type="text"
                placeholder="이름 (닉네임)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="flex-1 h-full text-[14px] outline-none placeholder:text-[#636363] bg-transparent"
                style={{ color: "rgba(255, 255, 255, 0.9)", border: "none", paddingLeft: 20, paddingRight: 12 }}
                required
              />
              {name && (
                <button
                  type="button"
                  className="shrink-0 mr-3 flex items-center justify-center cursor-pointer"
                  style={{ background: "none", border: "none" }}
                  onClick={() => setName("")}
                >
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <circle cx="9" cy="9" r="8" fill="rgba(255,255,255,0.12)" />
                    <path d="M6 6L12 12M12 6L6 12" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              )}
            </div>
          )}

          {/* Email field */}
          <div
            className="flex items-center rounded-[10px] overflow-hidden"
            style={{
              background: "rgba(255, 255, 255, 0.06)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              height: 44,
            }}
          >
            <input
              type="email"
              placeholder="이메일"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1 h-full text-[14px] outline-none placeholder:text-[#636363] bg-transparent"
              style={{ color: "rgba(255, 255, 255, 0.9)", border: "none", paddingLeft: 20, paddingRight: 12 }}
              required
            />
            {email && (
              <button
                type="button"
                className="shrink-0 mr-3 flex items-center justify-center cursor-pointer"
                style={{ background: "none", border: "none" }}
                onClick={() => setEmail("")}
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <circle cx="9" cy="9" r="8" fill="rgba(255,255,255,0.12)" />
                  <path d="M6 6L12 12M12 6L6 12" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            )}
          </div>

          {/* Password field */}
          <div
            className="flex items-center rounded-[10px] overflow-hidden"
            style={{
              background: "rgba(255, 255, 255, 0.06)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              height: 44,
            }}
          >
            <input
              type={showPassword ? "text" : "password"}
              placeholder={mode === "signup" ? "비밀번호 (4자 이상)" : "비밀번호"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="flex-1 h-full text-[14px] outline-none placeholder:text-[#636363] bg-transparent"
              style={{ color: "rgba(255, 255, 255, 0.9)", border: "none", paddingLeft: 20, paddingRight: 12 }}
              required
              minLength={mode === "signup" ? 4 : undefined}
            />
            {password && (
              <button
                type="button"
                className="shrink-0 mr-1 flex items-center justify-center cursor-pointer"
                style={{ background: "none", border: "none" }}
                onClick={() => setPassword("")}
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <circle cx="9" cy="9" r="8" fill="rgba(255,255,255,0.12)" />
                  <path d="M6 6L12 12M12 6L6 12" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            )}
            <button
              type="button"
              className="shrink-0 mr-3 flex items-center justify-center cursor-pointer"
              style={{ background: "none", border: "none" }}
              onClick={() => setShowPassword((v) => !v)}
            >
              {showPassword ? (
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M10 5C5.5 5 2 10 2 10s3.5 5 8 5 8-5 8-5-3.5-5-8-5Z" stroke="rgba(255,255,255,0.45)" strokeWidth="1.3" strokeLinejoin="round" />
                  <circle cx="10" cy="10" r="2.5" stroke="rgba(255,255,255,0.45)" strokeWidth="1.3" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M10 5C5.5 5 2 10 2 10s3.5 5 8 5 8-5 8-5-3.5-5-8-5Z" stroke="rgba(255,255,255,0.45)" strokeWidth="1.3" strokeLinejoin="round" />
                  <circle cx="10" cy="10" r="2.5" stroke="rgba(255,255,255,0.45)" strokeWidth="1.3" />
                  <path d="M3 17L17 3" stroke="rgba(255,255,255,0.45)" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
              )}
            </button>
          </div>

          {/* Error message */}
          {error && (
            <p className="text-[13px] px-1" style={{ color: "rgba(255, 120, 120, 0.9)" }}>
              {error}
            </p>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-[10px] text-[14px] font-semibold transition-all hover:brightness-125 disabled:opacity-50 cursor-pointer"
            style={{
              height: 44,
              marginTop: 4,
              background: "rgba(255, 235, 170, 0.25)",
              border: "1px solid rgba(255, 235, 170, 0.15)",
              color: "rgba(255, 235, 170, 0.95)",
            }}
          >
            {loading
              ? (mode === "login" ? "로그인 중..." : "가입 중...")
              : (mode === "login" ? "로그인" : "가입하기")
            }
          </button>

          {/* Kakao login button */}
          {mode === "login" && (
            <button
              type="button"
              className="w-full rounded-[10px] text-[14px] font-medium cursor-pointer transition-all hover:brightness-110 flex items-center justify-center gap-2"
              style={{
                height: 44,
                background: "#FEE500",
                border: "none",
                color: "rgba(0, 0, 0, 0.85)",
              }}
              onClick={() => {
                window.location.href = "/api/auth/kakao";
              }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M9 1C4.58 1 1 3.87 1 7.39c0 2.21 1.44 4.15 3.62 5.3l-.93 3.41c-.08.28.25.5.49.34l4.07-2.68c.25.02.5.03.75.03 4.42 0 8-2.87 8-6.4C17 3.87 13.42 1 9 1Z" fill="rgba(0,0,0,0.85)" />
              </svg>
              카카오로 시작하기
            </button>
          )}

          {/* Mode switch button */}
          <button
            type="button"
            className="w-full rounded-[10px] text-[14px] font-medium cursor-pointer transition-all hover:brightness-125"
            style={{
              height: 44,
              background: "transparent",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              color: "rgba(255, 255, 255, 0.55)",
            }}
            onClick={() => { setMode(mode === "login" ? "signup" : "login"); reset(); }}
          >
            {mode === "login" ? "이메일로 가입하기" : "로그인으로 돌아가기"}
          </button>
        </form>
      </div>
    </div>
  );
}
