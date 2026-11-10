import { ArrowLeft } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { PageHeader } from '../components/layout/PageHeader';
import { ReviewCard } from '../components/reviews/ReviewCard';
import { PlaceImage } from '../components/ui/PlaceImage';
import { ScoreBadge } from '../components/ui/ScoreBadge';
import { EmptyState, ErrorState, PageLoader } from '../components/ui/States';
import { useAsync } from '../hooks/useAsync';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { ApiError, api } from '../services/api';
import { TYPE_LABELS, placeArea, plural } from '../utils/format';
import { NotFoundPage } from './NotFoundPage';

export function FriendsPage() {
  useDocumentTitle('Opiniones por amigo');
  const { data: friends, error, reload } = useAsync(() => api.friends(), []);
  return (
    <>
      <PageHeader
        kicker="La mesa"
        title="Opiniones por amigo"
        intro="Consulta todo lo que ha opinado cada persona con la que has compartido un café."
      />
      <section className="container section--flush">
        {error && <ErrorState error={error} onRetry={reload} />}
        {!error && !friends && <PageLoader />}
        {friends?.length === 0 && (
          <EmptyState
            title="Todavía no hay opiniones"
            message="Entra al perfil de un lugar y agrega la opinión de alguien con quien lo visitaste."
            action={
              <Link to="/todas" className="btn btn--primary">
                Ver los lugares
              </Link>
            }
          />
        )}
        {friends && friends.length > 0 && (
          <ul className="friend-grid">
            {friends.map((friend) => (
              <li key={friend.id} className="friend-card">
                <span className="review__initial" aria-hidden="true">
                  {friend.name.charAt(0).toUpperCase()}
                </span>
                <div className="friend-card__main">
                  <h2 className="friend-card__name">
                    <Link to={`/amigos/${friend.id}`} className="card__link">
                      {friend.name}
                    </Link>
                  </h2>
                  <p className="friend-card__meta">{plural(friend.reviewCount, 'opinión', 'opiniones')}</p>
                </div>
                <ScoreBadge score={friend.averageScore} size="small" label="Su promedio" emptyLabel="s/c" />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

export function FriendPage() {
  const { id } = useParams();
  const numericId = Number(id);
  const { data: friend, error, reload } = useAsync(() => api.friend(numericId), [numericId]);
  useDocumentTitle(friend?.name);

  if (error instanceof ApiError && error.status === 404) return <NotFoundPage />;
  if (error) {
    return (
      <div className="container section">
        <ErrorState error={error} onRetry={reload} />
      </div>
    );
  }
  if (!friend) return <PageLoader />;

  return (
    <>
      <PageHeader
        kicker="Historial de opiniones"
        title={friend.name}
        intro={`${plural(friend.reviews.length, 'lugar evaluado', 'lugares evaluados')}.`}
      >
        <div className="friend-header__score">
          <ScoreBadge score={friend.averageScore} label="Su promedio" emptyLabel="Sin notas" />
          <span>Su promedio</span>
        </div>
        <Link to="/amigos" className="section__more friend-header__back">
          <ArrowLeft aria-hidden size={16} /> Todos los amigos
        </Link>
      </PageHeader>
      <section className="container section--flush">
        <div className="review-grid">
          {friend.reviews.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              heading={
                <div className="review__place">
                  <div className="review__place-media">
                    <PlaceImage photo={review.establishment.mainPhoto} name={review.establishment.name} type={review.establishment.type} />
                  </div>
                  <div>
                    <h2 className="review__name">
                      <Link to={`/lugar/${review.establishment.id}`}>{review.establishment.name}</Link>
                    </h2>
                    <p className="friend-card__meta">
                      {TYPE_LABELS[review.establishment.type]} · {placeArea(review.establishment)}
                    </p>
                  </div>
                </div>
              }
            />
          ))}
        </div>
      </section>
    </>
  );
}
