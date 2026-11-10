"use client";

import { createContext, useContext } from "react";

/** The site whose media library the editor is working with. Image fields read it to open the picker. */
export const MediaCtx = createContext<{ slug: string } | null>(null);
export const useMediaSite = () => useContext(MediaCtx);
