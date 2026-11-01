"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

const STORAGE_KEY = "shootit-gallery-size";
const GallerySizeContext = createContext({ size: 100, setSize: (_size: number) => {} });

function isValidSize(size: number) {
  return Number.isInteger(size) && size >= 75 && size <= 200 && size % 5 === 0;
}

export function GallerySizeProvider({ children }: { children: ReactNode }) {
  const [size, setSizeState] = useState(100);

  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(STORAGE_KEY));
      if (isValidSize(saved)) setSizeState(saved);
    } catch {
      // Storage can be blocked; the current session still supports resizing.
    }
  }, []);

  useEffect(() => {
    // Gallery dialogs use portals, so the scale must also reach the document root.
    document.documentElement.style.setProperty("--gallery-scale", String(size / 100));
  }, [size]);

  function setSize(value: number) {
    if (!isValidSize(value)) return;
    setSizeState(value);
    try {
      localStorage.setItem(STORAGE_KEY, String(value));
    } catch {
      // Keep the in-memory preference when storage is unavailable.
    }
  }

  return <GallerySizeContext.Provider value={{ size, setSize }}>{children}</GallerySizeContext.Provider>;
}

export function useGallerySize() {
  return useContext(GallerySizeContext);
}
