import { NextResponse } from "next/server";

const KAKAO_CLIENT_ID = process.env.KAKAO_CLIENT_ID || "dba4871fd1420edecb5e60d6293c2ab0";

export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  const redirectUri = `${origin}/api/auth/kakao/callback`;

  const kakaoAuthUrl = new URL("https://kauth.kakao.com/oauth/authorize");
  kakaoAuthUrl.searchParams.set("client_id", KAKAO_CLIENT_ID);
  kakaoAuthUrl.searchParams.set("redirect_uri", redirectUri);
  kakaoAuthUrl.searchParams.set("response_type", "code");

  return NextResponse.redirect(kakaoAuthUrl.toString());
}
