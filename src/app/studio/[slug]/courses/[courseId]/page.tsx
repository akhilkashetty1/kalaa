import Link from "next/link";
import { notFound } from "next/navigation";
import { CourseFields } from "@/components/course-fields";
import { NoAccess } from "@/components/no-access";
import { ActionForm } from "@/components/studio-ui";
import { requireSiteAccess } from "@/server/auth";
import { listCourses } from "@/server/data";
import { siteOrigin } from "@/server/tenant";
import { updateCourse } from "../../../actions";

export default async function EditCoursePage({ params }: { params: Promise<{ slug: string; courseId: string }> }) {
  const { slug, courseId } = await params;
  const { site, role, allowed } = await requireSiteAccess(slug, "courses.manage");
  if (!allowed) return <NoAccess role={role} slug={slug} what="Courses" />;
  const course = (await listCourses(site.id)).find((c) => c.id === courseId);
  if (!course) notFound();

  return (
    <>
      <div className="ws-head">
        <div><div className="eyebrow"><Link href={`/studio/${slug}/courses`}>← Courses</Link></div><h1>{course.title}</h1></div>
        <div className="row">
          <span className={`pill ${course.published ? "ok" : ""}`}>{course.published ? "Published" : "Draft"}</span>
          {course.published && <a className="btn sm" href={`${siteOrigin(site)}/courses/${course.slug}`} target="_blank" rel="noopener">View page ↗</a>}
        </div>
      </div>
      <div className="panel">
        <div className="card-h"><h2>Course details and lessons</h2><span className="mono muted">Learners see changes straight away</span></div>
        <div className="card-b">
          <ActionForm action={updateCourse.bind(null, slug, course.id)} submit="Save changes" className="form-grid">
            <CourseFields course={course} slug={slug} />
          </ActionForm>
        </div>
      </div>
    </>
  );
}
