import Link from "next/link";
import { ROLE_META } from "@/lib/roles";
import type { Role } from "@/lib/types";

/** Shown to a teammate whose role doesn't include this page. Distinct from a 404: they do belong to the site. */
export function NoAccess({ role, slug, what }: { role: Role; slug: string; what: string }) {
  return (
    <div className="panel" style={{ padding: 28, maxWidth: 560 }}>
      <div className="eyebrow">Not part of your role</div>
      <h1 style={{ fontFamily: "var(--f-display)", fontWeight: 500, fontSize: 32, margin: "8px 0 10px" }}>{what} is for co-owners and the owner</h1>
      <p className="muted">
        You&apos;re signed in as {ROLE_META[role].label}. {ROLE_META[role].blurb} Ask an owner or co-owner if you need access.
      </p>
      <p style={{ marginTop: 18 }}><Link className="btn sm" href={`/studio/${slug}`}>Back to overview</Link></p>
    </div>
  );
}
