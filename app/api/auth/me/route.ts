import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

interface UserRow {
  id: number;
  email: string;
  name: string;
}

export async function GET() {
  const auth = await getAuthUser();
  if (!auth) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  const user = db
    .prepare("SELECT id, email, name FROM users WHERE id = ?")
    .get(auth.userId) as UserRow | undefined;

  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  return NextResponse.json({ user });
}
