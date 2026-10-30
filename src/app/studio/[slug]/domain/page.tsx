import { ActionButton, ActionForm, ConfirmButton, CopyText } from "@/components/studio-ui";
import { NoAccess } from "@/components/no-access";
import { requireSiteAccess } from "@/server/auth";
import { CNAME_TARGET, ROOT_DOMAIN, customDomainOrigin, subdomainOrigin } from "@/lib/config";
import { addDomain, removeDomain, verifyDomain } from "../../actions";

const STATUS = {
  pending: { cls: "wait", label: "Waiting for DNS" },
  issuing: { cls: "wait", label: "Issuing SSL" },
  active: { cls: "ok", label: "Live with HTTPS" },
  error: { cls: "bad", label: "Needs attention" },
} as const;

export default async function DomainPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { site, role, allowed } = await requireSiteAccess(slug, "domain.manage");
  if (!allowed) return <NoAccess role={role} slug={slug} what="Domain settings" />;
  const d = site.domain;
  const label = d ? d.hostname.split(".").slice(0, -2).join(".") || "@" : "learn";
  const step = !d ? 1 : d.status === "active" ? 4 : d.status === "issuing" ? 3 : 2;

  return (
    <>
      <div className="ws-head">
        <div><div className="eyebrow">Domain</div><h1>Your own address</h1></div>
        <div className="row">
          <a className="pill" href={subdomainOrigin(site.slug)} target="_blank" rel="noopener">Free address: {site.slug}.{ROOT_DOMAIN}</a>
        </div>
      </div>

      <div className="steps">
        <div className={`panel step ${step > 1 ? "done" : ""}`}><span className="n">Step 1</span><b>Add your domain</b><p>Use a subdomain you own, like learn.yourname.in.</p></div>
        <div className={`panel step ${step > 2 ? "done" : ""}`}><span className="n">Step 2</span><b>Add one DNS record</b><p>At your registrar (GoDaddy, Hostinger, Cloudflare), add the CNAME below.</p></div>
        <div className={`panel step ${step > 3 ? "done" : ""}`}><span className="n">Step 3</span><b>Verify</b><p>We check DNS and issue an SSL certificate for you. No files to upload.</p></div>
      </div>

      {!d ? (
        <div className="panel">
          <div className="card-h"><h2>Connect a domain</h2></div>
          <div className="card-b">
            <ActionForm action={addDomain.bind(null, slug)} submit="Add domain">
              <div className="field" style={{ maxWidth: 420 }}>
                <label htmlFor="hostname">Domain</label>
                <input className="input" id="hostname" name="hostname" placeholder="learn.yourname.in" required />
                <span className="hint">Testing locally? Any name ending in .localhost works without DNS, e.g. learn.{site.slug}.localhost</span>
              </div>
            </ActionForm>
          </div>
        </div>
      ) : (
        <div className="panel">
          <div className="card-h">
            <h2>{d.hostname}</h2>
            <span className={`pill ${STATUS[d.status].cls}`}><span className="dot" />{STATUS[d.status].label}</span>
          </div>
          <div className="card-b" style={{ display: "grid", gap: 14 }}>
            {d.message && <p className={d.status === "error" ? "error" : "muted"}>{d.message}</p>}
            <div className="table-box panel" style={{ boxShadow: "none" }}>
              <table className="table dns">
                <thead><tr><th>Type</th><th>Name</th><th>Value</th></tr></thead>
                <tbody>
                  <tr>
                    <td>CNAME</td>
                    <td><CopyText text={label} /></td>
                    <td><CopyText text={CNAME_TARGET} /></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              {d.status === "active" ? (
                <a className="btn gold sm" href={customDomainOrigin(d.hostname)} target="_blank" rel="noopener">Open {d.hostname} ↗</a>
              ) : (
                <ActionButton run={verifyDomain.bind(null, slug)} className="btn gold sm" pendingLabel="Checking DNS…">Verify DNS</ActionButton>
              )}
              {d.status === "active" && <ActionButton run={verifyDomain.bind(null, slug)} pendingLabel="Checking…">Re-check</ActionButton>}
              <ConfirmButton run={removeDomain.bind(null, slug)} label="Remove domain" confirmLabel="Remove" />
              {d.checkedAt && <span className="mono muted">Last checked {new Date(d.checkedAt).toLocaleString("en-IN", { timeStyle: "short", dateStyle: "medium" })}</span>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
