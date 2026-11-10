import { ArrowRight, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Establishment } from '../../types';
import { TYPE_LABELS, placeArea } from '../../utils/format';
import { PlaceImage } from '../ui/PlaceImage';
import { ScoreBadge } from '../ui/ScoreBadge';

export function PlaceTags({ place }: { place: Establishment }) {
  return (
    <ul className="tags" aria-label="Etiquetas">
      {place.isDemo && <li className="tag tag--demo">Ejemplo ficticio</li>}
      {place.inPassport && <li className="tag tag--passport">Pasaporte</li>}
      {place.offersFood && <li className="tag">Comida</li>}
      {place.offersDesserts && <li className="tag">Postres</li>}
      {place.offersSugarFree && <li className="tag">Sin azúcar</li>}
      {place.offersBoardGames && <li className="tag">Juegos de mesa</li>}
      {place.offersSeasonalDrinks && <li className="tag">Bebidas de temporada</li>}
      {place.visitStatus === 'pendiente' && <li className="tag tag--pending">Por visitar</li>}
    </ul>
  );
}

export function EstablishmentCard({ place }: { place: Establishment }) {
  return (
    <article className="card">
      <div className="card__media">
        <PlaceImage photo={place.mainPhoto} name={place.name} type={place.type} />
        <span className="card__score">
          <ScoreBadge score={place.scores.personal} label="Mi calificación" />
        </span>
      </div>
      <div className="card__body">
        <p className="card__type">{TYPE_LABELS[place.type]}</p>
        <h3 className="card__title">
          {/* El enlace se extiende por CSS a toda la tarjeta. */}
          <Link to={`/lugar/${place.id}`} className="card__link">
            {place.name}
          </Link>
        </h3>
        <p className="card__place">
          <MapPin aria-hidden size={15} />
          {placeArea(place)}
        </p>
        <PlaceTags place={place} />
        <span className="card__cta" aria-hidden="true">
          Ver perfil <ArrowRight size={15} />
        </span>
      </div>
    </article>
  );
}

export function EstablishmentRow({ place }: { place: Establishment }) {
  return (
    <article className="row">
      <div className="row__media">
        <PlaceImage photo={place.mainPhoto} name={place.name} type={place.type} />
      </div>
      <div className="row__main">
        <h3 className="row__title">
          <Link to={`/lugar/${place.id}`} className="card__link">
            {place.name}
          </Link>
        </h3>
        <p className="row__meta">
          {TYPE_LABELS[place.type]} · {placeArea(place)}
        </p>
        <PlaceTags place={place} />
      </div>
      <ScoreBadge score={place.scores.personal} label="Mi calificación" />
    </article>
  );
}
