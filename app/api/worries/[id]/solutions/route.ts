import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthUser();
  if (!auth) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  }

  const { id: worryIdStr } = await params;
  const worryId = parseInt(worryIdStr, 10);

  const { text } = await request.json();
  if (!text?.trim()) {
    return NextResponse.json(
      { error: "해결책을 입력해주세요" },
      { status: 400 }
    );
  }

  // Check worry exists
  const worry = db.prepare("SELECT id FROM worries WHERE id = ?").get(worryId);
  if (!worry) {
    return NextResponse.json(
      { error: "고민을 찾을 수 없습니다" },
      { status: 404 }
    );
  }

  const result = db
    .prepare(
      "INSERT INTO solutions (worry_id, user_id, text) VALUES (?, ?, ?)"
    )
    .run(worryId, auth.userId, text.trim());

  const user = db
    .prepare("SELECT name FROM users WHERE id = ?")
    .get(auth.userId) as { name: string };

  return NextResponse.json({
    solution: {
      id: `s_${result.lastInsertRowid}`,
      dbId: result.lastInsertRowid,
      userId: auth.userId,
      userName: user.name,
      text: text.trim(),
    },
  });
}
