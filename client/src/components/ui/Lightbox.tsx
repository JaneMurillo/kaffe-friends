import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface LightboxProps {
  images: { url: string; alt: string }[];
  startIndex: number;
  onClose: () => void;
}

export function Lightbox({ images, startIndex, onClose }: LightboxProps) {
  const [index, setIndex] = useState(startIndex);
  const ref = useRef<HTMLDialogElement>(null);
  const many = images.length > 1;
  const image = images[index];

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => dialog?.close();
  }, []);

  const move = (delta: number) => setIndex((current) => (current + delta + images.length) % images.length);

  if (!image) return null;

  return (
    <dialog
      ref={ref}
      className="lightbox"
      aria-label="Fotografía ampliada"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onKeyDown={(event) => {
        if (event.key === 'ArrowRight' && many) move(1);
        if (event.key === 'ArrowLeft' && many) move(-1);
      }}
    >
      <img className="lightbox__image" src={image.url} alt={image.alt} />
      <button type="button" className="lightbox__btn lightbox__close" aria-label="Cerrar" onClick={onClose}>
        <X aria-hidden />
      </button>
      {many && (
        <>
          <button type="button" className="lightbox__btn lightbox__prev" aria-label="Fotografía anterior" onClick={() => move(-1)}>
            <ChevronLeft aria-hidden />
          </button>
          <button type="button" className="lightbox__btn lightbox__next" aria-label="Fotografía siguiente" onClick={() => move(1)}>
            <ChevronRight aria-hidden />
          </button>
          <p className="lightbox__count">
            {index + 1} de {images.length}
          </p>
        </>
      )}
    </dialog>
  );
}
