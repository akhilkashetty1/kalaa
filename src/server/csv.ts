/**
 * One CSV cell. A spreadsheet runs a cell that starts with = + - @ as a formula, so those get a leading
 * quote; fields with commas, quotes or line breaks are quoted.
 */
export function csvCell(v: string) {
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export const csvResponse = (lines: string[], filename: string) =>
  new Response("﻿" + lines.join("\r\n") + "\r\n", {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });
