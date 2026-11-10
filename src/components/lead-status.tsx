"use client";

import { useState, useTransition } from "react";
import { removeLead, updateLeadStatus } from "@/app/studio/lead-actions";
import { ConfirmButton } from "./studio-ui";

const LABELS = { new: "New", contacted: "Contacted", closed: "Closed" } as const;

/** Moves a lead through new, contacted and closed. */
export function LeadStatus({ slug, id, status }: { slug: string; id: string; status: keyof typeof LABELS }) {
  const [value, setValue] = useState(status);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <span style={{ display: "inline-flex", flexDirection: "column", gap: 4 }}>
      <select
        className="input"
        style={{ padding: "5px 8px", width: "auto" }}
        aria-label="Lead status"
        value={value}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value as keyof typeof LABELS;
          const prev = value;
          setValue(next);
          setError("");
          start(async () => {
            const res = await updateLeadStatus(slug, id, next);
            if (res.error) {
              setValue(prev);
              setError(res.error);
            }
          });
        }}
      >
        {Object.entries(LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </select>
      {error && <span className="error" role="alert" style={{ fontSize: 12 }}>{error}</span>}
    </span>
  );
}

/** Deletes a lead after one confirmation. The action is bound here because a server page can't hand a function to a client component. */
export function LeadDelete({ slug, id }: { slug: string; id: string }) {
  return <ConfirmButton label="Delete" confirmLabel="Delete" run={() => removeLead(slug, id)} />;
}
