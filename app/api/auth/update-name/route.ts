import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

export async function POST(request: Request) {
  const auth = await getAuthUser();
  if (!auth) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  }

  const { name } = await request.json();

  if (!name?.trim() || name.trim().length < 1) {
    return NextResponse.json({ error: "닉네임을 입력해주세요" }, { status: 400 });
  }

  if (name.trim().length > 20) {
    return NextResponse.json({ error: "닉네임은 20자 이하로 입력해주세요" }, { status: 400 });
  }

  db.prepare("UPDATE users SET name = ? WHERE id = ?").run(name.trim(), auth.userId);

  return NextResponse.json({ ok: true, name: name.trim() });
}
