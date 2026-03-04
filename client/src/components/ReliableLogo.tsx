import { useEffect, useMemo, useState } from "react";

interface ReliableLogoProps {
  sources: Array<string | null | undefined>;
  alt: string;
  className?: string;
  fallback?: React.ReactNode;
}

/**
 * Renders the first working image from a list of sources.
 * Automatically falls back to the next candidate if an image fails to load.
 * Shows a text fallback if all images fail.
 */
export function ReliableLogo({ sources, alt, className, fallback }: ReliableLogoProps) {
  // Normalize and filter valid sources
  const normalized = useMemo(
    () =>
      sources
        .filter(Boolean)
        .map((s) => String(s).trim())
        .filter((s) => s.length > 0),
    [sources]
  );

  const [currentIndex, setCurrentIndex] = useState(0);
  const [allFailed, setAllFailed] = useState(false);

  // Reset when sources change
  useEffect(() => {
    setCurrentIndex(0);
    setAllFailed(false);
  }, [normalized.join("|")]);

  const handleError = () => {
    if (currentIndex < normalized.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      setAllFailed(true);
    }
  };

  // No valid sources or all failed - show fallback
  if (normalized.length === 0 || allFailed) {
    return <>{fallback ?? null}</>;
  }

  const src = normalized[currentIndex];

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      style={{ background: "transparent" }}
      onError={handleError}
    />
  );
}

export default ReliableLogo;
