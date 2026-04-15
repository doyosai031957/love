import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

interface WorryRow {
  id: number;
  user_id: number;
  user_name: string;
  text: string;
  x: number;
  y: number;
  size: number;
  float_phase: number;
  float_speed: number;
  float_amplitude_x: number;
  float_amplitude_y: number;
}

interface SolutionRow {
  id: number;
  worry_id: number;
  user_id: number;
  user_name: string;
  text: string;
}

export async function GET() {
  const worries = db
    .prepare(
      `SELECT w.id, w.user_id, u.name as user_name, w.text, w.x, w.y, w.size,
              w.float_phase, w.float_speed, w.float_amplitude_x, w.float_amplitude_y
       FROM worries w JOIN users u ON w.user_id = u.id
       ORDER BY w.created_at ASC`
    )
    .all() as WorryRow[];

  const solutions = db
    .prepare(
      `SELECT s.id, s.worry_id, s.user_id, u.name as user_name, s.text
       FROM solutions s JOIN users u ON s.user_id = u.id
       ORDER BY s.created_at ASC`
    )
    .all() as SolutionRow[];

  const result = worries.map((w) => ({
    id: `w_${w.id}`,
    dbId: w.id,
    userId: w.user_id,
    userName: w.user_name,
    text: w.text,
    x: w.x,
    y: w.y,
    size: w.size,
    floatPhase: w.float_phase,
    floatSpeed: w.float_speed,
    floatAmplitudeX: w.float_amplitude_x,
    floatAmplitudeY: w.float_amplitude_y,
    solutions: solutions
      .filter((s) => s.worry_id === w.id)
      .map((s) => ({
        id: `s_${s.id}`,
        dbId: s.id,
        userId: s.user_id,
        userName: s.user_name,
        text: s.text,
      })),
  }));

  return NextResponse.json({ worries: result });
}

export async function POST(request: Request) {
  const auth = await getAuthUser();
  if (!auth) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  }

  const { text, x, y, size, floatPhase, floatSpeed, floatAmplitudeX, floatAmplitudeY } =
    await request.json();

  if (!text?.trim()) {
    return NextResponse.json({ error: "고민을 입력해주세요" }, { status: 400 });
  }

  const result = db
    .prepare(
      `INSERT INTO worries (user_id, text, x, y, size, float_phase, float_speed, float_amplitude_x, float_amplitude_y)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      auth.userId,
      text.trim(),
      x ?? 0,
      y ?? 0,
      size ?? 85,
      floatPhase ?? Math.random() * Math.PI * 2,
      floatSpeed ?? 0.005 + Math.random() * 0.005,
      floatAmplitudeX ?? 8 + Math.random() * 10,
      floatAmplitudeY ?? 6 + Math.random() * 10
    );

  const user = db
    .prepare("SELECT name FROM users WHERE id = ?")
    .get(auth.userId) as { name: string };

  return NextResponse.json({
    worry: {
      id: `w_${result.lastInsertRowid}`,
      dbId: result.lastInsertRowid,
      userId: auth.userId,
      userName: user.name,
      text: text.trim(),
      x,
      y,
      size,
      floatPhase,
      floatSpeed,
      floatAmplitudeX,
      floatAmplitudeY,
      solutions: [],
    },
  });
}
