import { redirect } from "next/navigation";
import { LearnerLoginForm } from "@/components/learner-login-form";
import { t } from "@/lib/i18n";
import { currentLearner, safeLearnerNext } from "@/server/learner-auth";
import { siteFromParam } from "@/server/tenant";

export const metadata = { title: "Sign in", robots: { index: false } };

export default async function LearnerLoginPage({ params, searchParams }: { params: Promise<{ site: string }>; searchParams: Promise<{ next?: string }> }) {
  const site = await siteFromParam((await params).site);
  const next = safeLearnerNext((await searchParams).next);
  if (await currentLearner(site.id)) redirect(next);
  const s = t(site.theme.lang);

  return (
    <main className="auth">
      <div className="auth-card">
        <h1>{s.signInTitle}</h1>
        <p className="auth-sub">{s.signInSub}</p>
        <LearnerLoginForm next={next} s={s} />
      </div>
    </main>
  );
}
