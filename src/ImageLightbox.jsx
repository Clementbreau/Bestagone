import { useEffect } from 'react';
import './image-lightbox.css';

export default function ImageLightbox({ item, onClose }) {
  useEffect(() => {
    if (!item) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [item, onClose]);

  if (!item) return null;

  return (
    <div
      className="image-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={item.title ? `Image : ${item.title}` : 'Image en plein écran'}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <button
        className="image-lightbox__close"
        type="button"
        onClick={onClose}
        aria-label="Fermer l’image"
      >
        ×
      </button>

      <img
        className="image-lightbox__image"
        src={item.image_url}
        alt={item.title || 'Hexagone'}
        draggable="false"
        onMouseDown={(event) => event.stopPropagation()}
      />
    </div>
  );
}
