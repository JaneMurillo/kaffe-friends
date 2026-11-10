import { Star, Trash2, ZoomIn } from 'lucide-react';
import { useState } from 'react';
import { api } from '../../services/api';
import type { Photo, PhotoCategory } from '../../types';
import { PHOTO_CATEGORIES } from '../../utils/format';
import { useFeedback } from '../ui/Feedback';
import { Lightbox } from '../ui/Lightbox';

/** Galería de fotografías ya guardadas: ampliar, elegir principal y eliminar. */
export function PhotoManager({
  photos,
  name,
  onChange,
  showcase = false,
}: {
  photos: Photo[];
  name: string;
  onChange: (photos: Photo[]) => void;
  /** Mosaico grande para la ficha; el formulario conserva las miniaturas. */
  showcase?: boolean;
}) {
  const { toast, confirm } = useFeedback();
  const [zoomed, setZoomed] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<Photo[]>, success: string) => {
    setBusy(true);
    try {
      onChange(await action());
      toast(success);
    } catch (error) {
      toast((error as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (photo: Photo) => {
    const accepted = await confirm({
      title: 'Eliminar fotografía',
      message: 'La fotografía se borrará de tu guía. Esta acción no se puede deshacer.',
      confirmLabel: 'Eliminar',
    });
    if (accepted) await run(() => api.deletePhoto(photo.id), 'Fotografía eliminada.');
  };

  return (
    <>
      <ul className={showcase ? 'gallery gallery--showcase' : 'gallery'}>
        {photos.map((photo, index) => (
          <li key={photo.id} className={`gallery__item ${photo.isMain ? 'is-main' : ''}`}>
            <button
              type="button"
              className="gallery__zoom"
              aria-label={`Ampliar fotografía ${index + 1} de ${name}`}
              onClick={() => setZoomed(index)}
            >
              {/* En el mosaico, el navegador elige la versión nítida según el tamaño en pantalla. */}
              <img
                src={photo.thumbUrl}
                srcSet={showcase ? `${photo.thumbUrl} 720w, ${photo.url} ${photo.width}w` : undefined}
                sizes={showcase ? '(max-width: 640px) 100vw, 66vw' : undefined}
                alt=""
                width={photo.width} height={photo.height} loading="lazy" decoding="async" />
              <ZoomIn aria-hidden size={20} className="gallery__zoom-icon" />
            </button>
            {photo.isMain && <span className="gallery__badge">Principal</span>}
            <label className="gallery__category">
              <span className="visually-hidden">Categoría de la fotografía {index + 1}</span>
              <select
                value={photo.category}
                disabled={busy}
                onChange={(event) =>
                  run(() => api.setPhotoCategory(photo.id, event.target.value as PhotoCategory), 'Categoría actualizada.')
                }
              >
                {PHOTO_CATEGORIES.map((category) => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="gallery__actions">
              {!photo.isMain && (
                <button
                  type="button"
                  className="icon-btn icon-btn--solid"
                  disabled={busy}
                  aria-label={`Usar la fotografía ${index + 1} como principal`}
                  title="Usar como principal"
                  onClick={() => run(() => api.setMainPhoto(photo.id), 'Fotografía principal actualizada.')}
                >
                  <Star aria-hidden size={17} />
                </button>
              )}
              <button
                type="button"
                className="icon-btn icon-btn--solid"
                disabled={busy}
                aria-label={`Eliminar la fotografía ${index + 1}`}
                title="Eliminar"
                onClick={() => remove(photo)}
              >
                <Trash2 aria-hidden size={17} />
              </button>
            </div>
          </li>
        ))}
      </ul>
      {zoomed !== null && (
        <Lightbox
          images={photos.map((photo) => ({ url: photo.url, alt: `Fotografía de ${name}` }))}
          startIndex={zoomed}
          onClose={() => setZoomed(null)}
        />
      )}
    </>
  );
}
