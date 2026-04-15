import { NextResponse } from "next/server";

const KAKAO_CLIENT_ID = process.env.KAKAO_CLIENT_ID || "dba4871fd1420edecb5e60d6293c2ab0";

function getOrigin(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-proto");
  const host = request.headers.get("host") || "localhost:3000";
  const protocol = forwarded || (host.includes("localhost") ? "http" : "https");
  return `${protocol}://${host}`;
}

export async function GET(request: Request) {
  const origin = getOrigin(request);
  const redirectUri = `${origin}/api/auth/kakao/callback`;

  const kakaoAuthUrl = new URL("https://kauth.kakao.com/oauth/authorize");
  kakaoAuthUrl.searchParams.set("client_id", KAKAO_CLIENT_ID);
  kakaoAuthUrl.searchParams.set("redirect_uri", redirectUri);
  kakaoAuthUrl.searchParams.set("response_type", "code");

  return NextResponse.redirect(kakaoAuthUrl.toString());
}
