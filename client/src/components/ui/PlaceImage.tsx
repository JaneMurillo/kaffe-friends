import type { EstablishmentType, Photo } from '../../types';
import { BreadIllustration, CupIllustration } from './Illustrations';

interface PlaceImageProps {
  photo: Photo | null;
  name: string;
  type: EstablishmentType;
  /** full usa la imagen grande; por defecto la miniatura, más ligera. */
  size?: 'thumb' | 'full';
  className?: string;
  priority?: boolean;
}

const TONES = ['beige', 'espresso', 'sage', 'roast'] as const;

/** El tono depende del nombre: un lugar sin foto se ve siempre igual y distinto a los demás. */
function toneFor(name: string) {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) % 997;
  return TONES[hash % TONES.length]!;
}

export function PlaceImage({ photo, name, type, size = 'thumb', className = '', priority = false }: PlaceImageProps) {
  if (photo) {
    return (
      <img
        className={`place-image ${className}`}
        src={size === 'full' ? photo.url : photo.thumbUrl}
        alt={`Fotografía de ${name}`}
        width={photo.width}
        height={photo.height}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
      />
    );
  }
  const Art = type === 'panaderia' ? BreadIllustration : CupIllustration;
  return (
    <div className={`place-image place-image--empty place-image--${toneFor(name)} ${className}`} role="img" aria-label={`${name}, sin fotografía todavía`}>
      <Art className="place-image__art" />
    </div>
  );
}
