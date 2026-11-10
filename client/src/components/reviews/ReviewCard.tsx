import { CalendarDays, Pencil, Trash2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { Review } from '../../types';
import { formatDate } from '../../utils/format';
import { AnswerTags } from '../ui/AnswerTags';
import { Lightbox } from '../ui/Lightbox';
import { ScoreBadge } from '../ui/ScoreBadge';

interface ReviewCardProps {
  review: Review;
  /** Título opcional; en el historial de un amigo es el lugar. */
  heading?: ReactNode;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function ReviewCard({ review, heading, onEdit, onDelete }: ReviewCardProps) {
  const [zoomed, setZoomed] = useState(false);
  return (
    <article className="review">
      <header className="review__header">
        <div className="review__who">
          {heading ?? (
            <>
              <span className="review__initial" aria-hidden="true">
                {review.friendName.charAt(0).toUpperCase()}
              </span>
              <div>
                <h3 className="review__name">
                  <Link to={`/amigos/${review.friendId}`}>{review.friendName}</Link>
                </h3>
                <p className="review__role">Opinión de amigo</p>
              </div>
            </>
          )}
        </div>
        <ScoreBadge score={review.score} label={`Calificación de ${review.friendName}`} emptyLabel="Sin nota" />
      </header>
      {review.ordered && (
        <p className="review__ordered">
          <span>Pidió</span> {review.ordered}
        </p>
      )}
      <AnswerTags answers={review.answers} label={`Respuestas de ${review.friendName}`} />
      {review.comment && <p className="review__comment">{review.comment}</p>}
      {review.photoThumbUrl && review.photoUrl && (
        <button
          type="button"
          className="review__photo"
          aria-label={`Ampliar la fotografía de ${review.friendName}`}
          onClick={() => setZoomed(true)}
        >
          <img src={review.photoThumbUrl} alt="" loading="lazy" decoding="async" />
        </button>
      )}
      <footer className="review__footer">
        {review.visitDate ? (
          <span className="review__date">
            <CalendarDays aria-hidden size={15} /> {formatDate(review.visitDate)}
          </span>
        ) : (
          <span />
        )}
        {(onEdit || onDelete) && (
          <span className="review__actions">
            {onEdit && (
              <button type="button" className="icon-btn" aria-label={`Editar la opinión de ${review.friendName}`} onClick={onEdit}>
                <Pencil aria-hidden size={17} />
              </button>
            )}
            {onDelete && (
              <button type="button" className="icon-btn" aria-label={`Eliminar la opinión de ${review.friendName}`} onClick={onDelete}>
                <Trash2 aria-hidden size={17} />
              </button>
            )}
          </span>
        )}
      </footer>
      {zoomed && review.photoUrl && (
        <Lightbox
          images={[{ url: review.photoUrl, alt: `Fotografía de ${review.friendName}` }]}
          startIndex={0}
          onClose={() => setZoomed(false)}
        />
      )}
    </article>
  );
}
