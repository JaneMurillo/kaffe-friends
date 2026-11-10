/**
 * Datos de demostración, opcionales y claramente marcados. Son lugares ficticios: llevan
 * "(Ejemplo)" en el nombre e is_demo = 1, y no tienen coordenadas porque no existen.
 *
 *   npm run demo:add      agrega los ejemplos
 *   npm run demo:remove   los elimina sin tocar tus datos reales
 */
import { closeDatabase, openDatabase } from '../db/connection.js';
import { establishmentModel } from '../models/establishment.model.js';
import { createEstablishment, deleteEstablishment } from '../services/establishments.service.js';
import { createReview } from '../services/reviews.service.js';
import { answersSchema, establishmentSchema } from '../validation/schemas.js';

const NEIGHBORHOOD = 'Colonia de ejemplo';
const ADDRESS = 'Dirección de ejemplo (lugar ficticio)';

const samples = [
  {
    place: {
      name: 'Café Muestra (Ejemplo)',
      type: 'cafeteria',
      visitStatus: 'visitado',
      visitDate: '2026-01-15',
      description: 'Registro ficticio para mostrar cómo se ve una cafetería con bebidas y postres.',
      inPassport: true,
      offersDrinks: true,
      offersFood: false,
      offersDesserts: true,
      offersSugarFree: true,
      observations: 'Observación ficticia para mostrar cómo se ven tus notas.',
      consumed: { bebida: 'Espresso de muestra', postre: 'Galleta de muestra' },
      answers: {
        ambiente: ['acogedor', 'tranquilo'],
        cafe: 'excelente',
        precios: 'razonables',
        favorito: 'cafe',
        atencion: 'buena',
        trabajo: 'comodo',
        volveria: 'si',
        productos: ['postres', 'sin_azucar'],
      },
      scores: { cafe: 9, ambiente: 8, precios: 7, atencion: 9 },
    },
    reviews: [{ friendName: 'Amiga de ejemplo', score: 10, comment: 'Opinión ficticia de demostración.' }],
  },
  {
    place: {
      name: 'Panadería Muestra (Ejemplo)',
      type: 'panaderia',
      visitStatus: 'pendiente',
      description: 'Registro ficticio de una panadería pendiente de visitar.',
      inPassport: true,
      offersDrinks: false,
      offersFood: false,
      offersDesserts: true,
      ratings: {},
    },
    reviews: [],
  },
  {
    place: {
      name: 'Casa Muestra (Ejemplo)',
      type: 'cafeteria',
      visitStatus: 'visitado',
      visitDate: '2026-02-20',
      description: 'Registro ficticio de una cafetería con bebidas y comida, sin postres.',
      inPassport: false,
      offersDrinks: true,
      offersFood: true,
      offersDesserts: false,
      ratings: {
        bebidas: { score: 9, comment: '', highlights: '' },
        comida: { score: 8, comment: '', highlights: 'Molletes de muestra' },
      },
    },
    reviews: [{ friendName: 'Amigo de ejemplo', score: 7, comment: 'Otra opinión ficticia.' }],
  },
];

async function add() {
  if (establishmentModel.findDemoIds().length > 0) {
    console.log('Los datos de ejemplo ya existen.');
    return;
  }
  for (const sample of samples) {
    const input = establishmentSchema.parse({ ...sample.place, address: ADDRESS, neighborhood: NEIGHBORHOOD });
    const created = createEstablishment(input, { isDemo: true });
    for (const review of sample.reviews) {
      await createReview(created.id, { ...review, ordered: '', answers: answersSchema.parse({}), visitDate: null, removePhoto: false });
    }
  }
  console.log(`Se agregaron ${samples.length} lugares de ejemplo.`);
}

function remove() {
  const ids = establishmentModel.findDemoIds();
  for (const id of ids) deleteEstablishment(id);
  console.log(`Se eliminaron ${ids.length} lugares de ejemplo.`);
}

openDatabase();
const action = process.argv[2];
try {
  if (action === 'add') await add();
  else if (action === 'remove') remove();
  else console.log('Uso: demo.ts add | remove');
} finally {
  closeDatabase();
}
