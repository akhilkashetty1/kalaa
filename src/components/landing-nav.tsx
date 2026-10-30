import Link from "next/link";
import { currentCreator } from "@/server/auth";

/**
 * Top bar shared by the home page and Explore. Teachers signed in on the platform host see their studio
 * instead of the sign-in buttons. Student sign-in is per storefront, so it never appears here.
 */
export async function LandingNav() {
  const creator = await currentCreator();
  return (
    <header className="mk-nav">
      <Link href="/" className="logo"><i>क</i>Kalaa</Link>
      <nav aria-label="Main">
        <Link href="/#product">Product</Link>
        <Link href="/#industries">Who it's for</Link>
        <Link href="/#students">Students</Link>
        <Link href="/explore">Explore</Link>
      </nav>
      <span className="mk-sp" />
      {creator ? (
        <Link className="btn gold sm" href="/studio">Open studio</Link>
      ) : (
        <>
          <Link className="btn sm" href="/login">Sign in</Link>
          <Link className="btn gold sm" href="/login?next=/studio">Start free</Link>
        </>
      )}
    </header>
  );
}

export function LandingFooter() {
  return (
    <footer className="mk-foot">
      <div><Link href="/" className="logo"><i>क</i>Kalaa</Link><p>The home for independent educators in India.</p></div>
      <div className="mk-foot-cols">
        <div><b>Teachers</b><Link href="/login?next=/studio">Start free</Link><Link href="/login">Sign in</Link><Link href="/#product">What's inside</Link></div>
        <div><b>Students</b><Link href="/explore">Find a teacher</Link><Link href="/#students">How it works</Link></div>
      </div>
      <p className="mk-copy">© {new Date().getFullYear()} Kalaa</p>
    </footer>
  );
}
