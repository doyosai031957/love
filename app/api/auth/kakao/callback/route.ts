import { NextResponse } from "next/server";
import db from "@/lib/db";
import { createToken, setAuthCookie } from "@/lib/auth";

const KAKAO_CLIENT_ID = process.env.KAKAO_CLIENT_ID || "h3luTnc8szLkMJgC6n4T7cg7wyaWHDj8";

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

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
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
        redirect_uri: redirectUri,
        code,
      }),
    });

    if (!tokenRes.ok) {
      return NextResponse.redirect(`${origin}/?login_error=카카오 인증에 실패했습니다`);
    }

    const tokenData: KakaoTokenResponse = await tokenRes.json();

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
    await setAuthCookie(token);

    return NextResponse.redirect(origin);
  } catch {
    return NextResponse.redirect(`${origin}/?login_error=카카오 로그인 중 오류가 발생했습니다`);
  }
}
