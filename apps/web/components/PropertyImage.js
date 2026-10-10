'use client';

import { useEffect, useState } from 'react';
import { PROPERTY_PLACEHOLDER_IMAGE } from '../lib/property-assets';

export default function PropertyImage({ src, alt, className }) {
  const [imageSrc, setImageSrc] = useState(src || PROPERTY_PLACEHOLDER_IMAGE);
  useEffect(() => {
    setImageSrc(src || PROPERTY_PLACEHOLDER_IMAGE);
  }, [src]);
  return (
    <img
      className={className}
      src={imageSrc}
      alt={alt}
      onError={() => setImageSrc(current => current === PROPERTY_PLACEHOLDER_IMAGE ? current : PROPERTY_PLACEHOLDER_IMAGE)}
    />
  );
}
