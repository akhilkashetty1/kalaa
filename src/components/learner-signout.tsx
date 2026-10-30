"use client";

import { useTransition } from "react";
import { learnerSignOut } from "@/app/sites/[site]/auth-actions";

export function LearnerSignOut({ label }: { label: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      className="bbtn ghost sm"
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await learnerSignOut();
          window.location.assign("/");
        })
      }
    >
      {label}
    </button>
  );
}
