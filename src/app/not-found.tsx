import { platformOrigin } from "@/lib/config";

// Unknown hosts (no matching subdomain or active custom domain) and unknown platform pages.
export default function NotFound() {
  return (
    <div className="shell" style={{ minHeight: "100dvh", display: "grid", placeItems: "center", textAlign: "center" }}>
      <div>
        <div className="eyebrow">404</div>
        <h1 style={{ fontFamily: "var(--f-display)", fontWeight: 500, fontSize: 48, marginTop: 10 }}>Nothing here yet</h1>
        <p className="muted" style={{ marginTop: 10 }}>This address isn&apos;t connected to a Kalaa site, or the page doesn&apos;t exist.</p>
        <p style={{ marginTop: 22 }}>
          <a className="btn gold" href={platformOrigin()}>Go to Kalaa</a>
        </p>
      </div>
    </div>
  );
}
