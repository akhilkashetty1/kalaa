import { signOut } from "@/app/login/actions";
import type { Creator } from "@/lib/types";

export function AccountChip({ creator, role }: { creator: Creator; role?: string }) {
  return (
    <form action={signOut} className="who-chip">
      {role && <span className="pill gold" style={{ maxWidth: "none" }}>{role}</span>}
      <span title={creator.email}>{creator.email}</span>
      <button className="btn sm" type="submit">Sign out</button>
    </form>
  );
}
