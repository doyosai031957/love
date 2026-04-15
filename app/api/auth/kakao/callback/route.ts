import { NextResponse } from "next/server";
import db from "@/lib/db";
import { createToken } from "@/lib/auth";

const KAKAO_CLIENT_ID = process.env.KAKAO_CLIENT_ID || "dba4871fd1420edecb5e60d6293c2ab0";
const KAKAO_CLIENT_SECRET = process.env.KAKAO_CLIENT_SECRET || "h3luTnc8szLkMJgC6n4T7cg7wyaWHDj8";

interface KakaoTokenResponse {
  access_token: string;
}

interface KakaoUserResponse {
  id: number;
  kakao_account?: {
    email?: string;
    profile?: {
      nickname?: string;
    };
  };
}

interface UserRow {
  id: number;
  email: string;
  name: string;
}

function getOrigin(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-proto");
  const host = request.headers.get("host") || "localhost:3000";
  const protocol = forwarded || (host.includes("localhost") ? "http" : "https");
  return `${protocol}://${host}`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const origin = getOrigin(request);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(`${origin}/?login_error=카카오 로그인이 취소되었습니다`);
  }

  try {
    const redirectUri = `${origin}/api/auth/kakao/callback`;

    // 1. Exchange code for access token
    const tokenRes = await fetch("https://kauth.kakao.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: KAKAO_CLIENT_ID,
        client_secret: KAKAO_CLIENT_SECRET,
        redirect_uri: redirectUri,
        code,
      }),
    });

    const tokenText = await tokenRes.text();
    if (!tokenRes.ok) {
      console.error("Kakao token error:", tokenText);
      return NextResponse.redirect(`${origin}/?login_error=${encodeURIComponent(tokenText)}`);
    }

    const tokenData: KakaoTokenResponse = JSON.parse(tokenText);

    // 2. Get user info
    const userRes = await fetch("https://kapi.kakao.com/v2/user/me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!userRes.ok) {
      return NextResponse.redirect(`${origin}/?login_error=카카오 사용자 정보를 가져올 수 없습니다`);
    }

    const kakaoUser: KakaoUserResponse = await userRes.json();
    const kakaoId = String(kakaoUser.id);
    const email = kakaoUser.kakao_account?.email || `kakao_${kakaoId}@kakao.local`;
    const name = kakaoUser.kakao_account?.profile?.nickname || `카카오유저`;

    // 3. Find or create user
    let user = db
      .prepare("SELECT id, email, name FROM users WHERE kakao_id = ?")
      .get(kakaoId) as UserRow | undefined;

    if (!user) {
      // Check if email already exists (previously signed up with email)
      user = db
        .prepare("SELECT id, email, name FROM users WHERE email = ?")
        .get(email) as UserRow | undefined;

      if (user) {
        // Link kakao_id to existing account
        db.prepare("UPDATE users SET kakao_id = ? WHERE id = ?").run(kakaoId, user.id);
      } else {
        // Create new user
        const result = db
          .prepare("INSERT INTO users (email, name, password, kakao_id) VALUES (?, ?, '', ?)")
          .run(email, name, kakaoId);
        user = { id: Number(result.lastInsertRowid), email, name };
      }
    }

    // 4. Set JWT cookie and redirect
    const token = await createToken(user.id);
    const response = NextResponse.redirect(`${origin}/`);
    response.cookies.set("auth-token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });
    return response;
  } catch (err) {
    console.error("Kakao login error:", err);
    const msg = err instanceof Error ? err.message : "unknown";
    return NextResponse.redirect(`${origin}/?login_error=${encodeURIComponent(msg)}`);
  }
}
