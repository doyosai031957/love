import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getAuthUser, clearAuthCookie } from "@/lib/auth";

export async function POST() {
  const auth = await getAuthUser();
  if (!auth) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  }

  // Delete user's solutions, worries, then user
  db.prepare("DELETE FROM solutions WHERE user_id = ?").run(auth.userId);
  db.prepare("DELETE FROM worries WHERE user_id = ?").run(auth.userId);
  db.prepare("DELETE FROM users WHERE id = ?").run(auth.userId);

  await clearAuthCookie();

  return NextResponse.json({ ok: true });
}
