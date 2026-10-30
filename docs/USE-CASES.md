# Use-case audit

Every person who touches Kalaa, what they need to do, and whether the product does it today.
**Works** = built and tested. **Partial** = usable but rough. **Gap** = not built.

## 1. A teacher who has never heard of Kalaa (home page and Explore)
| Need | Status |
| --- | --- |
| Understand what Kalaa is in ten seconds | Works: home page sells the whole business (site, courses, students, payments, team), not "custom sites" |
| See that it is honest about what exists | Works: every capability is tagged Live, Listings today or Coming soon |
| See real examples for my kind of teaching | Works: seven industry templates, each linking to `Start with this`, and seven demo sites on Explore |
| Know the price | Partial: says free during early access. No plans or prices yet. A business decision |
| Trust it (terms, privacy, refund policy, contact) | **Gap**: no legal or contact pages. Needed before real payments or a public launch |

## 2. A new teacher (first hour)
| Need | Status |
| --- | --- |
| Sign up without a password | Works: emailed code |
| Start from something that fits my business | Works: pick one of seven industries; get the layout, look and wording for it. New sites get no invented stats or testimonials |
| Know what to do next | Works: setup checklist on the overview |
| Add a course with lessons | Works: row-by-row editor (title, minutes, free toggle, link), drag to reorder, or paste a list |
| Attach PDFs, slides and worksheets | Works: up to 10 files per lesson, 15 MB each, checked by content. Free-preview lessons' files are public; the rest need a confirmed payment |
| Host my videos | **Gap**: YouTube/Vimeo links only. No video upload or hosting, and no quizzes |
| Tell students how to pay | Works: UPI ID in Settings; students get a pay button |
| Use my own domain | Works |
| Share my site | Partial: the address is shown. No share buttons or QR |

## 3. Owner and co-owner (running the business)
| Need | Status |
| --- | --- |
| Edit the site visually | Works: drag-and-drop editor, inline text, looks, undo |
| Create, edit, publish, unpublish courses | Works. A course with paying students can't be deleted |
| See who reserved a seat and follow up | Works: reservations list with WhatsApp button |
| Confirm a payment and give access | Works: one tap, emailed to the student, logged. Revoke works too |
| Invite, change, remove teammates; transfer ownership | Works, with an activity log |
| See how the business is doing | Partial: counts and rupee totals on the overview. No visits, conversion, trends |
| Offer discounts or coupons | **Gap** |
| Refund a student | Partial: revoke access only. Money moves outside Kalaa |
| Message all students (announcements) | **Gap** |
| See every student, including ones who haven't bought | Works: Students page lists everyone who signed in or reserved, with per-course progress, filters and CSV (owner/co-owner) |
| Email all paid students of a course | Works: test-to-self, confirm, 5 per day, replies go to the teacher. **Gap**: no unsubscribe link yet |
| Export my data | **Gap** |
| Run live classes | **Gap**: batches are announced with dates and seats; no classroom or join link |
| Collect money automatically | **Gap**: payments are direct to my UPI and confirmed by hand. Razorpay is the next step |
| GST invoices | **Gap** |

## 4. Editor and support roles
| Need | Status |
| --- | --- |
| Editor edits brand and courses | Works |
| Editor can't see student phone numbers or emails | Works |
| Support sees reservations and WhatsApps students | Works |
| Support can't change or confirm anything | Works |
| Anyone can leave a team | Works |

## 5. A student
| Need | Status |
| --- | --- |
| Find a teacher | Works: Explore with categories and search |
| Try before paying | Works: free preview lessons without signing in |
| Sign in without a password | Works: emailed code, per teacher |
| Reserve a seat and pay | Works: reservation, then a UPI button with amount and course filled in |
| Know my payment is being checked | Works: "waiting for confirmation" state in My courses |
| Get access once confirmed | Works: emailed, and the course appears |
| Learn: watch, mark complete, resume | Works: progress saved per lesson, resume button |
| Use it in Hindi | Works for the storefront and sign-in |
| One account across teachers | **Gap**: accounts are per teacher |
| Edit my name or delete my account | **Gap** |
| Certificates, receipts, discussion, mobile app | **Gap** |

## 6. Kalaa itself (the operator)
| Need | Status |
| --- | --- |
| See all teachers, courses, activity | **Gap**: no admin console |
| Suspend a site or remove a listing | **Gap** (Explore listing can be turned off by the teacher only) |
| Handle abuse reports | **Gap**: no report button |
| Bill teachers | **Gap** (free for now) |

## 7. Engineering before a public launch
- **Storage:** a JSON file. Move to Postgres before more than one server or real users.
- **Email:** the sending path is written but has never sent a real email. Add a Resend key and verify a domain.
- **Rate limits** live in the data file, so they need Redis or Postgres too.
- **Attached files** sit on local disk under `.data/files`. Move them to S3 or R2 (same functions in `lib/files.ts`) before running on more than one server. There is no virus scan.
- **Video links are not copy-protected.** Signed, expiring URLs (Mux or Cloudflare Stream) are the real fix.
- **Backups, monitoring, error tracking** are not set up.

## Suggested order
1. Razorpay checkout in test mode (removes the biggest manual step).
2. Postgres and a real email provider (can't launch without them).
3. Terms, privacy and refund pages, plus a contact route.
4. Hosted video upload (with signed URLs), and quizzes.
5. A student list, announcements and coupons for teachers.
6. A Kalaa admin console (see teachers, suspend, handle reports).
