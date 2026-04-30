import { useState } from 'react';
import { getPublicAssetUrl } from '../lib/seed-assets';

const VIVIENNE_PORTRAIT_SRC = getPublicAssetUrl('assets/characters/vivienne-ashcroft.jpg');
const VIVIENNE_PORTRAIT_ALT = 'Vivienne Ashcroft portrait';

interface ViviennePortraitProps {
  imageClassName: string;
  fallbackClassName: string;
}

export default function ViviennePortrait({ imageClassName, fallbackClassName }: ViviennePortraitProps) {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return <span className={fallbackClassName}>V</span>;
  }

  return (
    <img
      src={VIVIENNE_PORTRAIT_SRC}
      alt={VIVIENNE_PORTRAIT_ALT}
      className={imageClassName}
      decoding="async"
      loading="eager"
      onError={() => setHasError(true)}
    />
  );
}