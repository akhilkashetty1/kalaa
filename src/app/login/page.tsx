import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { currentCreator, safeNext } from "@/server/auth";

export const metadata = { title: "Sign in · Kalaa" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  if (await currentCreator()) redirect(next);
  const devMail = process.env.NODE_ENV !== "production" && !process.env.RESEND_API_KEY;

  return (
    <div className="shell">
      <div className="wrap">
        <header className="topbar">
          <Link href="/" className="logo"><i>क</i>Kalaa</Link>
        </header>
        <div className="login">
          <div className="panel login-card">
            <div className="eyebrow">Creator studio</div>
            <h1>Sign in</h1>
            <p className="muted">We&apos;ll email you a 6-digit code. No password to remember.</p>
            <LoginForm next={next} />
            {devMail && (
              <p className="hint dev">
                Local mode: codes are printed in the dev server log. Sample creators: ishaan@example.com, meher@example.com.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
