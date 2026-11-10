import { loadAll, type EstablishmentDto } from './establishments.service.js';
import { average } from './scores.service.js';

export type RankingKind = 'personal' | 'community';

/**
 * Ranking independiente por tipo de puntuación. El personal lee SOLO scores.personal, de modo
 * que las opiniones de amigos no pueden alterarlo. Los empates comparten posición (1, 2, 2, 4).
 */
export function buildRanking(kind: RankingKind, direction: 'asc' | 'desc') {
  const scoreOf = (place: EstablishmentDto) => place.scores[kind];
  const ranked = loadAll()
    .filter((place) => scoreOf(place) !== null)
    .sort((a, b) => scoreOf(b)! - scoreOf(a)! || a.name.localeCompare(b.name, 'es'));

  const entries = ranked.map((place, index) => ({ place, position: index + 1, score: scoreOf(place)! }));
  for (let index = 1; index < entries.length; index += 1) {
    const current = entries[index]!;
    const previous = entries[index - 1]!;
    if (current.score === previous.score) current.position = previous.position;
  }
  return direction === 'desc' ? entries : entries.reverse();
}

export function getStats() {
  const places = loadAll();
  const personal = places.flatMap((place) => (place.scores.personal === null ? [] : [place.scores.personal]));
  const newestFirst = [...places].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id);
  return {
    total: places.length,
    cafeterias: places.filter((place) => place.type === 'cafeteria').length,
    panaderias: places.filter((place) => place.type === 'panaderia').length,
    averagePersonal: average(personal),
    latest: newestFirst.slice(0, 4),
    top: buildRanking('personal', 'desc').slice(0, 4),
  };
}

export function getPassport() {
  const places = loadAll()
    .filter((place) => place.inPassport)
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  const visited = places.filter((place) => place.visitStatus === 'visitado').length;
  return {
    total: places.length,
    visited,
    pending: places.length - visited,
    percent: places.length === 0 ? 0 : Math.round((visited / places.length) * 100),
    places,
  };
}
