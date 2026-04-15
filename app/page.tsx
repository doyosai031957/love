import { getAuthUser } from "@/lib/auth";
import db from "@/lib/db";
import WorryUniverse from "./components/WorryUniverse";

interface UserRow {
  id: number;
  email: string;
  name: string;
}

export default async function Home() {
  let user = null;

  const auth = await getAuthUser();
  if (auth) {
    const row = db
      .prepare("SELECT id, email, name FROM users WHERE id = ?")
      .get(auth.userId) as UserRow | undefined;
    if (row) {
      user = row;
    }
  }

  return <WorryUniverse user={user} />;
}
