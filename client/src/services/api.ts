import type {
  Answers,
  AvailabilityItem,
  BackupInfo,
  Consumed,
  DetailScores,
  Establishment,
  EstablishmentDetail,
  EstablishmentInput,
  FriendHistory,
  FriendSummary,
  PassportSummary,
  Photo,
  PhotoCategory,
  RankingEntry,
  ResolvedPlace,
  Review,
  ReviewInput,
  SeasonalProduct,
  Stats,
  VisitStatus,
} from '../types';

export const UNAUTHORIZED_EVENT = 'kaffe:sin-sesion';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly fields: Record<string, string> = {},
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, init);
  } catch {
    throw new ApiError('No se pudo conectar con el servidor local. ¿Sigue abierta la ventana de la aplicación?', 0);
  }
  if (response.status === 204) return undefined as T;
  const body = await response.json().catch(() => null);
  if (response.status === 401 && !path.startsWith('/auth/')) window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
  if (!response.ok) {
    throw new ApiError(body?.error?.message ?? 'Ocurrió un error inesperado.', response.status, body?.error?.fields);
  }
  return body as T;
}

const json = (method: string, data: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data),
});

function toQuery(params: Record<string, string | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value) query.set(key, value);
  const text = query.toString();
  return text ? `?${text}` : '';
}

function reviewForm(input: ReviewInput): FormData {
  const form = new FormData();
  form.set('friendName', input.friendName);
  form.set('score', input.score === null ? '' : String(input.score));
  form.set('comment', input.comment);
  form.set('ordered', input.ordered);
  form.set('answers', JSON.stringify(input.answers));
  form.set('visitDate', input.visitDate ?? '');
  form.set('removePhoto', String(input.removePhoto));
  if (input.photo) form.set('photo', input.photo);
  return form;
}

export interface SeasonalInput {
  name: string;
  triedOn: string;
  note: string;
  status: SeasonalProduct['status'];
  photo: File | null;
  removePhoto: boolean;
}

function seasonalForm(input: SeasonalInput): FormData {
  const form = new FormData();
  form.set('name', input.name);
  form.set('triedOn', input.triedOn);
  form.set('note', input.note);
  form.set('status', input.status);
  form.set('removePhoto', String(input.removePhoto));
  if (input.photo) form.set('photo', input.photo);
  return form;
}

export const api = {
  authStatus: () => request<{ required: boolean; authenticated: boolean }>('/auth/status'),
  login: (password: string) => request<void>('/auth/login', json('POST', { password })),

  resolveGoogleMapsLink: (url: string) => request<ResolvedPlace>('/google-maps/resolve', json('POST', { url })),

  stats: () => request<Stats>('/stats'),
  passport: () => request<PassportSummary>('/passport'),
  ranking: (kind: 'personal' | 'community', dir: 'asc' | 'desc') =>
    request<RankingEntry[]>(`/rankings${toQuery({ kind, dir })}`),

  establishments: (params: Record<string, string | undefined> = {}) =>
    request<Establishment[]>(`/establishments${toQuery(params)}`),
  neighborhoods: () => request<string[]>('/establishments/neighborhoods'),
  establishment: (id: number) => request<EstablishmentDetail>(`/establishments/${id}`),
  createEstablishment: (data: EstablishmentInput) =>
    request<EstablishmentDetail>('/establishments', json('POST', data)),
  updateEstablishment: (id: number, data: EstablishmentInput) =>
    request<EstablishmentDetail>(`/establishments/${id}`, json('PUT', data)),
  updateVisit: (id: number, visitStatus: VisitStatus, visitDate: string | null) =>
    request<EstablishmentDetail>(`/establishments/${id}/visit`, json('PATCH', { visitStatus, visitDate })),
  deleteEstablishment: (id: number) => request<void>(`/establishments/${id}`, { method: 'DELETE' }),

  updateNotes: (id: number, data: { answers: Answers; scores: DetailScores; observations: string; consumed: Consumed }) =>
    request<EstablishmentDetail>(`/establishments/${id}/notes`, json('PATCH', data)),

  createAvailability: (id: number, data: Omit<AvailabilityItem, 'id'>) =>
    request<AvailabilityItem>(`/establishments/${id}/availability`, json('POST', data)),
  updateAvailability: (id: number, data: Omit<AvailabilityItem, 'id'>) =>
    request<AvailabilityItem>(`/availability/${id}`, json('PUT', data)),
  deleteAvailability: (id: number) => request<void>(`/availability/${id}`, { method: 'DELETE' }),

  createSeasonal: (id: number, input: SeasonalInput) =>
    request<SeasonalProduct>(`/establishments/${id}/seasonal`, { method: 'POST', body: seasonalForm(input) }),
  updateSeasonal: (id: number, input: SeasonalInput) =>
    request<SeasonalProduct>(`/seasonal/${id}`, { method: 'PUT', body: seasonalForm(input) }),
  deleteSeasonal: (id: number) => request<void>(`/seasonal/${id}`, { method: 'DELETE' }),

  addPhotos: (id: number, files: File[], mainIndex: number | null, category?: PhotoCategory) => {
    const form = new FormData();
    for (const file of files) form.append('photos', file);
    if (mainIndex !== null) form.set('mainIndex', String(mainIndex));
    if (category) form.set('category', category);
    return request<Photo[]>(`/establishments/${id}/photos`, { method: 'POST', body: form });
  },
  setMainPhoto: (photoId: number) => request<Photo[]>(`/photos/${photoId}/main`, { method: 'PATCH' }),
  setPhotoCategory: (photoId: number, category: PhotoCategory) =>
    request<Photo[]>(`/photos/${photoId}/category`, json('PATCH', { category })),
  deletePhoto: (photoId: number) => request<Photo[]>(`/photos/${photoId}`, { method: 'DELETE' }),

  createReview: (establishmentId: number, input: ReviewInput) =>
    request<Review>(`/establishments/${establishmentId}/reviews`, { method: 'POST', body: reviewForm(input) }),
  updateReview: (id: number, input: ReviewInput) =>
    request<Review>(`/reviews/${id}`, { method: 'PUT', body: reviewForm(input) }),
  deleteReview: (id: number) => request<void>(`/reviews/${id}`, { method: 'DELETE' }),
  friends: () => request<FriendSummary[]>('/friends'),
  friend: (id: number) => request<FriendHistory>(`/friends/${id}`),

  backups: () => request<BackupInfo[]>('/backups'),
  createBackup: () => request<BackupInfo>('/backups', { method: 'POST' }),
  deleteBackup: (name: string) => request<void>(`/backups/${encodeURIComponent(name)}`, { method: 'DELETE' }),
  restoreBackup: (name: string) =>
    request<{ safetyBackup: string }>(`/backups/${encodeURIComponent(name)}/restore`, { method: 'POST' }),
  restoreFromFile: (file: File) => {
    const form = new FormData();
    form.set('backup', file);
    return request<{ safetyBackup: string }>('/backups/restore', { method: 'POST', body: form });
  },
  backupDownloadUrl: (name: string) => `/api/backups/${encodeURIComponent(name)}/download`,
};
