import { LessonEditor } from "./lesson-editor";
import type { Course } from "@/lib/types";

/** The course form's inputs. Plain markup (no hooks), so the create and edit pages share it. */
export function CourseFields({ course, slug }: { course?: Course; slug: string }) {
  return (
    <>
      <div className="field full"><label htmlFor="title">Title</label><input className="input" id="title" name="title" placeholder="Organic Chemistry Crash Course" defaultValue={course?.title} required /></div>
      <div className="field full"><label htmlFor="summary">One-line promise</label><input className="input" id="summary" name="summary" placeholder="Reaction mechanisms you can draw from memory in 21 days." defaultValue={course?.summary} /></div>
      <div className="field"><label htmlFor="price">Price (₹)</label><input className="input" id="price" name="price" type="number" min={0} step={1} placeholder="2499" defaultValue={course?.priceInr} required /></div>
      <div className="field"><label htmlFor="mrp">Original price (₹, optional)</label><input className="input" id="mrp" name="mrp" type="number" min={0} step={1} placeholder="3999" defaultValue={course?.mrpInr} /></div>
      <div className="field"><label htmlFor="tag">Badge (optional)</label><input className="input" id="tag" name="tag" placeholder="New" maxLength={24} defaultValue={course?.tag} /></div>
      <div className="field full">
        <label>Lessons</label>
        <LessonEditor slug={slug} initial={course?.lessons ?? []} />
      </div>
    </>
  );
}
