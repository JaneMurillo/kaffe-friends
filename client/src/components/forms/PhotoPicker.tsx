import { ImagePlus, X } from 'lucide-react';
import { useEffect, useMemo } from 'react';

const ACCEPT = 'image/jpeg,image/png,image/webp,image/avif,image/gif,image/tiff';

/** Selección de fotografías nuevas, con vista previa, antes de subirlas al guardar. */
export function PhotoPicker({
  files,
  mainIndex,
  allowMain,
  onChange,
}: {
  files: File[];
  mainIndex: number;
  /** Si es falso, las fotos nuevas no compiten por ser la principal. */
  allowMain: boolean;
  onChange: (files: File[], mainIndex: number) => void;
}) {
  const previews = useMemo(() => files.map((file) => URL.createObjectURL(file)), [files]);
  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);

  const removeAt = (index: number) => {
    const next = files.filter((_, position) => position !== index);
    const nextMain = index === mainIndex ? 0 : index < mainIndex ? mainIndex - 1 : mainIndex;
    onChange(next, nextMain);
  };

  return (
    <div>
      <label className="dropzone">
        <ImagePlus aria-hidden size={26} />
        <span className="dropzone__title">Agregar fotografías desde tu dispositivo</span>
        <span className="dropzone__hint">JPG, PNG o WebP, hasta 15 MB cada una. Se optimizan automáticamente.</span>
        <input
          type="file"
          accept={ACCEPT}
          multiple
          className="visually-hidden"
          onChange={(event) => {
            const picked = Array.from(event.target.files ?? []);
            if (picked.length > 0) onChange([...files, ...picked], mainIndex);
            event.target.value = '';
          }}
        />
      </label>
      {files.length > 0 && (
        <ul className="gallery gallery--picker">
          {files.map((file, index) => (
            <li key={`${file.name}-${index}`} className={`gallery__item ${allowMain && index === mainIndex ? 'is-main' : ''}`}>
              <img src={previews[index]} alt={`Vista previa de ${file.name}`} />
              <div className="gallery__actions">
                <button
                  type="button"
                  className="icon-btn icon-btn--solid"
                  aria-label={`Quitar ${file.name}`}
                  onClick={() => removeAt(index)}
                >
                  <X aria-hidden size={17} />
                </button>
              </div>
              {allowMain && (
                <label className="gallery__main-choice">
                  <input
                    type="radio"
                    name="foto-principal"
                    checked={index === mainIndex}
                    onChange={() => onChange(files, index)}
                  />
                  Principal
                </label>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
