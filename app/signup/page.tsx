"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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

      router.push("/");
    } catch {
      setError("서버에 연결할 수 없습니다");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <div
        className="w-full max-w-sm p-8 rounded-2xl"
        style={{
          background: "rgba(255, 255, 255, 0.03)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
        }}
      >
        <h1
          className="text-2xl font-light text-center mb-8 tracking-wide"
          style={{ color: "rgba(255, 255, 255, 0.9)" }}
        >
          고민 우주 가입
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="text"
              placeholder="이름 (닉네임)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 rounded-lg text-sm outline-none placeholder:text-gray-600"
              style={{
                background: "rgba(255, 255, 255, 0.03)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                color: "rgba(255, 255, 255, 0.9)",
              }}
              required
            />
          </div>
          <div>
            <input
              type="email"
              placeholder="이메일"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-lg text-sm outline-none placeholder:text-gray-600"
              style={{
                background: "rgba(255, 255, 255, 0.03)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                color: "rgba(255, 255, 255, 0.9)",
              }}
              required
            />
          </div>
          <div>
            <input
              type="password"
              placeholder="비밀번호 (4자 이상)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-lg text-sm outline-none placeholder:text-gray-600"
              style={{
                background: "rgba(255, 255, 255, 0.03)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                color: "rgba(255, 255, 255, 0.9)",
              }}
              required
              minLength={4}
            />
          </div>

          {error && (
            <p className="text-sm" style={{ color: "rgba(255, 120, 120, 0.9)" }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg text-sm font-medium transition-all hover:brightness-125 disabled:opacity-50"
            style={{
              background: "rgba(255, 235, 170, 0.15)",
              border: "1px solid rgba(255, 235, 170, 0.3)",
              color: "rgba(255, 235, 170, 0.9)",
            }}
          >
            {loading ? "가입 중..." : "가입하기"}
          </button>
        </form>

        <p
          className="text-center text-sm mt-6"
          style={{ color: "rgba(255, 255, 255, 0.35)" }}
        >
          이미 계정이 있으신가요?{" "}
          <a
            href="/login"
            className="underline transition-all hover:brightness-150"
            style={{ color: "rgba(255, 235, 170, 0.7)" }}
          >
            로그인
          </a>
        </p>
      </div>
    </div>
  );
}
