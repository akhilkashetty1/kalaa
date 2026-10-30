import { CourseFields } from "@/components/course-fields";
import { ActionButton, ActionForm, ConfirmButton } from "@/components/studio-ui";
import Link from "next/link";
import { NoAccess } from "@/components/no-access";
import { requireSiteAccess } from "@/server/auth";
import { inr } from "@/lib/i18n";
import { listCourses } from "@/server/data";
import { createCourse, deleteCourse, toggleCourse } from "../../actions";

export default async function CoursesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { site, role, allowed } = await requireSiteAccess(slug, "courses.manage");
  if (!allowed) return <NoAccess role={role} slug={slug} what="Courses" />;
  const courses = await listCourses(site.id);

  return (
    <>
      <div className="ws-head"><div><div className="eyebrow">Courses</div><h1>Your catalogue</h1></div></div>

      <div className="panel">
        <div className="card-h"><h2>{courses.length} courses</h2><span className="mono muted">Only published courses appear on your storefront</span></div>
        {courses.length ? (
          <div className="table-box">
            <table className="table">
              <thead><tr><th>Course</th><th>Lessons</th><th>Price</th><th>Status</th><th /></tr></thead>
              <tbody>
                {courses.map((c) => (
                  <tr key={c.id}>
                    <td><Link href={`/studio/${slug}/courses/${c.id}`} style={{ fontWeight: 500 }}>{c.title}</Link><div className="mono muted">/courses/{c.slug}</div></td>
                    <td className="num">{c.lessons.length}</td>
                    <td className="num">{inr(c.priceInr)}</td>
                    <td>{c.published ? <span className="pill ok"><span className="dot" />Published</span> : <span className="pill">Draft</span>}</td>
                    <td>
                      <div className="actions">
                        <Link className="btn sm" href={`/studio/${slug}/courses/${c.id}`}>Edit</Link>
                        <ActionButton run={toggleCourse.bind(null, slug, c.id, !c.published)}>{c.published ? "Unpublish" : "Publish"}</ActionButton>
                        <ConfirmButton run={deleteCourse.bind(null, slug, c.id)} label="Delete" confirmLabel="Delete for good" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty">No courses yet. Create your first one below.</p>
        )}
      </div>

      <div className="panel">
        <div className="card-h"><h2>New course</h2><span className="mono muted">Saved as a draft</span></div>
        <div className="card-b">
          <ActionForm action={createCourse.bind(null, slug)} submit="Save draft" className="form-grid" resetOnOk>
            <CourseFields slug={slug} />
          </ActionForm>
        </div>
      </div>
    </>
  );
}
