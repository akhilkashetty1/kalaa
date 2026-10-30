import { NoAccess } from "@/components/no-access";
import { ActionForm } from "@/components/studio-ui";
import { requireSiteAccess } from "@/server/auth";
import { TEMPLATES } from "@/lib/templates";
import { siteOrigin } from "@/server/tenant";
import { saveSettings } from "../../actions";

export const metadata = { title: "Settings · Kalaa" };

export default async function SettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { site, role, allowed } = await requireSiteAccess(slug, "payments.confirm");
  if (!allowed) return <NoAccess role={role} slug={slug} what="Settings" />;

  return (
    <>
      <div className="ws-head"><div><div className="eyebrow">Settings</div><h1>Payments and listing</h1></div></div>
      <div className="panel">
        <div className="card-h"><h2>How students pay you</h2><span className="mono muted">Shown after they reserve a seat</span></div>
        <div className="card-b">
          <ActionForm action={saveSettings.bind(null, slug)} submit="Save settings" className="form-grid">
            <div className="field full">
              <label htmlFor="upiId">Your UPI ID</label>
              <input className="input" id="upiId" name="upiId" defaultValue={site.upiId} placeholder="yourname@bank" autoComplete="off" />
              <span className="hint">Students get a button that opens their UPI app with your ID and the course price filled in. Payments go straight to you. Leave blank to follow up on WhatsApp instead.</span>
            </div>
            <div className="field full">
              <label htmlFor="payNote">Message with the payment details (optional)</label>
              <textarea className="input prose" id="payNote" name="payNote" rows={3} maxLength={300} defaultValue={site.payNote} placeholder="After paying, WhatsApp the screenshot to 98xxxxxxxx. We confirm within a few hours." />
            </div>
            <div className="field">
              <label htmlFor="category">What you teach</label>
              <select className="input" id="category" name="category" defaultValue={site.category ?? "exam"}>
                {TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <span className="hint">Decides where you appear on Explore.</span>
            </div>
            <div className="field">
              <label>Explore</label>
              <label className="tog" style={{ justifyContent: "flex-start", gap: 10, color: "var(--chalk)" }}>
                <input type="checkbox" name="listed" defaultChecked={site.listed !== false} /> Show my site on Kalaa&apos;s Explore page
              </label>
              <span className="hint">Explore helps new students find you. Your own site stays at {siteOrigin(site)} either way.</span>
            </div>
          </ActionForm>
        </div>
      </div>
    </>
  );
}
