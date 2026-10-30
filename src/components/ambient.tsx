"use client";

import { mixHex, paletteOf } from "@/lib/theme";
import { ShaderCanvas } from "./shaders";
import { useSite } from "./site-context";

/** The page-wide backdrop: slow aurora or a faint grid. Grain is drawn by CSS on the same layer. */
export function Ambient() {
  const { theme } = useSite();
  const pal = paletteOf(theme);
  return (
    <div className="ambient" aria-hidden="true">
      {theme.ambient === "aurora" && <ShaderCanvas kind="aurora" colors={{ bg: pal.bg, a: theme.accent, b: theme.accent2 ?? mixHex(theme.accent, "#ffffff", 0.45), ink: pal.ink }} />}
      {theme.ambient === "grid" && <div className="ambient-grid" />}
    </div>
  );
}
