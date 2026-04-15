import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

export async function DELETE(
  _req: Request,
  ctx: RouteContext<"/api/worries/[id]">
) {
  const auth = await getAuthUser();
  if (!auth) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const worryId = Number(id);

  // Verify the worry belongs to the current user
  const worry = db
    .prepare("SELECT user_id FROM worries WHERE id = ?")
    .get(worryId) as { user_id: number } | undefined;

  if (!worry) {
    return NextResponse.json({ error: "고민을 찾을 수 없습니다" }, { status: 404 });
  }

  if (worry.user_id !== auth.userId) {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
  }

  // Delete solutions first, then the worry
  db.prepare("DELETE FROM solutions WHERE worry_id = ?").run(worryId);
  db.prepare("DELETE FROM worries WHERE id = ?").run(worryId);

  return NextResponse.json({ success: true });
}
