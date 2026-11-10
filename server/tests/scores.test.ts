import { describe, expect, it } from 'vitest';
import { average, computeScores, personalScore } from '../src/services/scores.service.js';

const all = { bebidas: true, comida: true, postres: true };

describe('personalScore', () => {
  it('promedia solo las categorías disponibles (ejemplo del brief: 9 y 8 = 8.5)', () => {
    expect(personalScore({ bebidas: true, comida: true, postres: false }, { bebidas: 9, comida: 8 })).toBe(8.5);
  });

  it('no asigna cero a una categoría sin calificar', () => {
    expect(personalScore(all, { bebidas: 10, comida: null })).toBe(10);
  });

  it('ignora una calificación de una categoría que el lugar no ofrece', () => {
    expect(personalScore({ bebidas: true, comida: false, postres: false }, { bebidas: 8, comida: 2 })).toBe(8);
  });

  it('devuelve null si no hay calificaciones', () => {
    expect(personalScore(all, {})).toBeNull();
    expect(average([])).toBeNull();
  });
});

describe('computeScores', () => {
  it('da el mismo peso a cada persona en la comunitaria', () => {
    // Yo 8, amigos 10 y 6 y 10: (8 + 10 + 6 + 10) / 4 = 8.5, no (8 + 8.67) / 2.
    const scores = computeScores(all, { bebidas: 8 }, [10, 6, 10]);
    expect(scores.personal).toBe(8);
    expect(scores.friends).toBe(8.67);
    expect(scores.community).toBe(8.5);
    expect(scores.friendCount).toBe(3);
  });

  it('excluye de los promedios las opiniones sin calificación', () => {
    const scores = computeScores(all, { bebidas: 8 }, [null, 10]);
    expect(scores.friends).toBe(10);
    expect(scores.community).toBe(9);
    expect(scores.friendCount).toBe(1);
  });

  it('las opiniones nunca modifican la calificación personal', () => {
    expect(computeScores(all, { bebidas: 8 }, [1, 1, 1]).personal).toBe(8);
  });

  it('sin calificación personal, la comunitaria usa solo a los amigos', () => {
    const scores = computeScores(all, {}, [7, 9]);
    expect(scores.personal).toBeNull();
    expect(scores.community).toBe(8);
  });

  it('sin ninguna calificación todo queda nulo', () => {
    expect(computeScores(all, {}, [null])).toEqual({
      personal: null,
      friends: null,
      community: null,
      friendCount: 0,
    });
  });
});
