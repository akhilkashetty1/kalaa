// Missing course or page on an existing site. Rendered inside the site's theme.
export default function SitePageNotFound() {
  return (
    <main className="notfound" style={{ minHeight: "50dvh" }}>
      <div>
        <h1>This page has moved</h1>
        <p>The course may have been renamed or unpublished.</p>
        <p style={{ marginTop: 20 }}>
          <a className="bbtn" href="/#courses">See all courses</a>
        </p>
      </div>
    </main>
  );
}
