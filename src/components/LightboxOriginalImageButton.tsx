"use client";

import { useLightboxState } from "yet-another-react-lightbox";
import { OriginalImageButton, type OriginalImage } from "./OriginalImageButton";

/** Use the actual displayed slide, including after swipes and arrow navigation. */
export function LightboxOriginalImageButton({ images }: { images: OriginalImage[] }) {
  const { currentIndex } = useLightboxState();
  return <OriginalImageButton image={images[currentIndex]} />;
}
