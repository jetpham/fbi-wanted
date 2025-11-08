"use client";

import { useState, useRef, useEffect } from "react";

interface WantedPersonCardProps {
  person: {
    image: {
      original: string | null;
      caption?: string | null;
    };
    name: string;
    detailUrl: string;
  };
  /** Optional callback when image fails to load */
  onImageError?: () => void;
  /** Optional callback when image successfully loads */
  onImageLoad?: () => void;
}

export function WantedPersonCard({
  person,
  onImageError,
  onImageLoad,
}: WantedPersonCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  const imageUrl = person.image.original ?? "";
  const altText = person.image.caption ?? person.name;

  // Check if image is already loaded (cached images)
  useEffect(() => {
    const img = imgRef.current;
    if (img?.complete) {
      if (img.naturalWidth === 0 || img.naturalHeight === 0) {
        setImageError(true);
        onImageError?.();
      } else {
        setImageLoaded(true);
        onImageLoad?.();
      }
    }
  }, [imageUrl, onImageError, onImageLoad]);

  // Don't render if image failed to load
  if (imageError) {
    return null;
  }

  return (
    <a
      href={person.detailUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`relative aspect-3/4 overflow-hidden ${imageLoaded ? "group" : ""}`}
      aria-label={`View details for ${person.name}`}
    >
      {!imageLoaded && !imageError && (
        <div className="absolute inset-0 h-full w-full bg-gray-200 animate-pulse" />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        src={imageUrl}
        alt={altText}
        className="h-full w-full object-cover object-center"
        loading="lazy"
        onLoad={(e) => {
          const img = e.currentTarget;
          // Check if image actually loaded (not a redirect to HTML)
          if (img.naturalWidth === 0 || img.naturalHeight === 0) {
            setImageError(true);
            onImageError?.();
            return;
          }
          setImageLoaded(true);
          onImageLoad?.();
        }}
        onError={() => {
          setImageError(true);
          onImageError?.();
        }}
        style={{ opacity: imageLoaded ? 1 : 0 }}
      />
      <div className="absolute inset-0 bg-black/60 opacity-0 transition-opacity group-hover:opacity-100 flex items-center justify-center">
        <p className="text-sm font-semibold text-white text-center px-2">
          {person.name}
        </p>
      </div>
    </a>
  );
}

