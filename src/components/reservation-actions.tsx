"use client";

import { setEnrollmentPaid } from "@/app/studio/actions";
import { ActionButton, ConfirmButton } from "./studio-ui";

/** Confirm or revoke a payment. Only rendered for roles that may confirm payments. */
export function ReservationActions({ slug, enrollmentId, paid }: { slug: string; enrollmentId: string; paid: boolean }) {
  return paid ? (
    <ConfirmButton label="Revoke access" confirmLabel="Revoke" run={() => setEnrollmentPaid(slug, enrollmentId, false)} />
  ) : (
    <ActionButton className="btn sm gold" pendingLabel="Confirming…" run={() => setEnrollmentPaid(slug, enrollmentId, true)}>Mark as paid</ActionButton>
  );
}
