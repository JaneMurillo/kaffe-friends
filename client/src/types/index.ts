export type EstablishmentType = 'cafeteria' | 'panaderia';
export type VisitStatus = 'visitado' | 'pendiente';
export type Category = 'bebidas' | 'comida' | 'postres';

export type PhotoCategory = 'lugar' | 'bebidas' | 'comida' | 'postres';

export interface Answers {
  ambiente: string[];
  cafe: string | null;
  precios: string | null;
  favorito: string | null;
  atencion: string | null;
  trabajo: string | null;
  volveria: string | null;
  productos: string[];
}

export interface Consumed {
  bebida: string;
  comida: string;
  postre: string;
}

export interface DetailScores {
  cafe: number | null;
  bebidas: number | null;
  comida: number | null;
  ambiente: number | null;
  precios: number | null;
  atencion: number | null;
}

export interface Photo {
  id: number;
  url: string;
  thumbUrl: string;
  width: number;
  height: number;
  isMain: boolean;
  category: PhotoCategory;
}

export interface Rating {
  score: number | null;
  comment: string;
  highlights: string;
}

export interface Scores {
  personal: number | null;
  friends: number | null;
  community: number | null;
  friendCount: number;
}

export interface Establishment {
  id: number;
  name: string;
  type: EstablishmentType;
  address: string;
  neighborhood: string;
  latitude: number | null;
  longitude: number | null;
  visitStatus: VisitStatus;
  visitDate: string | null;
  description: string;
  inPassport: boolean;
  offersDrinks: boolean;
  offersFood: boolean;
  offersDesserts: boolean;
  offersSugarFree: boolean;
  offersBoardGames: boolean;
  offersSeasonalDrinks: boolean;
  googleMapsUrl: string | null;
  googlePlaceId: string | null;
  observations: string;
  consumed: Consumed;
  answers: Answers;
  detailScores: DetailScores;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
  mainPhoto: Photo | null;
  ratings: Record<Category, Rating | null>;
  scores: Scores;
}

export interface Review {
  id: number;
  establishmentId: number;
  friendId: number;
  friendName: string;
  score: number | null;
  comment: string;
  ordered: string;
  answers: Answers;
  visitDate: string | null;
  photoUrl: string | null;
  photoThumbUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AvailabilityItem {
  id: number;
  productName: string;
  note: string;
  availableWhen: string;
  sellsOutFast: boolean;
}

export interface SeasonalProduct {
  id: number;
  name: string;
  triedOn: string;
  note: string;
  status: 'disponible' | 'temporal';
  photoUrl: string | null;
  photoThumbUrl: string | null;
}

export interface EstablishmentDetail extends Establishment {
  photos: Photo[];
  reviews: Review[];
  availability: AvailabilityItem[];
  seasonal: SeasonalProduct[];
}

export interface ResolvedPlace {
  name: string | null;
  address: string | null;
  neighborhood: string | null;
  latitude: number | null;
  longitude: number | null;
  googleMapsUrl: string;
  googlePlaceId: string | null;
  source: 'places' | 'link';
  apiConfigured: boolean;
  warnings: string[];
}

export interface EstablishmentInput {
  name: string;
  type: EstablishmentType;
  address: string;
  neighborhood: string;
  latitude: number | null;
  longitude: number | null;
  visitStatus: VisitStatus;
  visitDate: string | null;
  description: string;
  inPassport: boolean;
  offersDrinks: boolean;
  offersFood: boolean;
  offersDesserts: boolean;
  offersSugarFree: boolean;
  offersBoardGames: boolean;
  offersSeasonalDrinks: boolean;
  googleMapsUrl: string | null;
  googlePlaceId: string | null;
  observations: string;
  consumed: Consumed;
  answers: Answers;
  scores: DetailScores;
}

export interface RankingEntry {
  place: Establishment;
  position: number;
  score: number;
}

export interface Stats {
  total: number;
  cafeterias: number;
  panaderias: number;
  averagePersonal: number | null;
  latest: Establishment[];
  top: RankingEntry[];
}

export interface PassportSummary {
  total: number;
  visited: number;
  pending: number;
  percent: number;
  places: Establishment[];
}

export interface FriendSummary {
  id: number;
  name: string;
  reviewCount: number;
  averageScore: number | null;
}

export interface FriendHistory {
  id: number;
  name: string;
  averageScore: number | null;
  reviews: (Review & {
    establishment: {
      id: number;
      name: string;
      type: EstablishmentType;
      neighborhood: string;
      address: string;
      mainPhoto: Photo | null;
    };
  })[];
}

export interface BackupInfo {
  name: string;
  sizeBytes: number;
  createdAt: string;
}

export interface ReviewInput {
  friendName: string;
  score: number | null;
  comment: string;
  ordered: string;
  answers: Answers;
  visitDate: string | null;
  photo: File | null;
  removePhoto: boolean;
}
