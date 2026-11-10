/**
 * Migraciones incrementales del esquema. PRAGMA user_version guarda la versión
 * aplicada. Nunca se edita una migración publicada: los cambios se agregan al final,
 * para que una actualización del código conserve siempre los datos existentes.
 */
export const migrations: readonly string[] = [
  /* 1: esquema inicial */ `
  CREATE TABLE establishments (
    id             INTEGER PRIMARY KEY,
    name           TEXT NOT NULL CHECK (length(trim(name)) > 0),
    type           TEXT NOT NULL CHECK (type IN ('cafeteria', 'panaderia', 'ambas')),
    address        TEXT NOT NULL CHECK (length(trim(address)) > 0),
    neighborhood   TEXT NOT NULL CHECK (length(trim(neighborhood)) > 0),
    latitude       REAL CHECK (latitude BETWEEN -90 AND 90),
    longitude      REAL CHECK (longitude BETWEEN -180 AND 180),
    visit_status   TEXT NOT NULL DEFAULT 'pendiente' CHECK (visit_status IN ('visitado', 'pendiente')),
    visit_date     TEXT,
    description    TEXT NOT NULL DEFAULT '',
    in_passport    INTEGER NOT NULL DEFAULT 0 CHECK (in_passport IN (0, 1)),
    offers_drinks  INTEGER NOT NULL DEFAULT 1 CHECK (offers_drinks IN (0, 1)),
    offers_food    INTEGER NOT NULL DEFAULT 0 CHECK (offers_food IN (0, 1)),
    offers_desserts INTEGER NOT NULL DEFAULT 0 CHECK (offers_desserts IN (0, 1)),
    is_demo        INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0, 1)),
    created_at     TEXT NOT NULL,
    updated_at     TEXT NOT NULL,
    CHECK ((latitude IS NULL) = (longitude IS NULL))
  );

  -- Calificaciones personales: una fila por categoría aplicable.
  CREATE TABLE ratings (
    establishment_id INTEGER NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
    category   TEXT NOT NULL CHECK (category IN ('bebidas', 'comida', 'postres')),
    score      INTEGER CHECK (score BETWEEN 1 AND 10),
    comment    TEXT NOT NULL DEFAULT '',
    highlights TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (establishment_id, category)
  );

  CREATE TABLE photos (
    id               INTEGER PRIMARY KEY,
    establishment_id INTEGER NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
    filename         TEXT NOT NULL,
    thumb_filename   TEXT NOT NULL,
    width            INTEGER NOT NULL,
    height           INTEGER NOT NULL,
    is_main          INTEGER NOT NULL DEFAULT 0 CHECK (is_main IN (0, 1)),
    created_at       TEXT NOT NULL
  );
  CREATE INDEX idx_photos_establishment ON photos(establishment_id);
  -- La base de datos garantiza una sola fotografía principal por lugar.
  CREATE UNIQUE INDEX idx_photos_one_main ON photos(establishment_id) WHERE is_main = 1;

  -- Los amigos no tienen cuenta: solo un nombre que agrupa sus opiniones.
  CREATE TABLE friends (
    id   INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE
  );

  -- Tabla separada de ratings: las opiniones nunca alteran la calificación personal.
  CREATE TABLE reviews (
    id               INTEGER PRIMARY KEY,
    establishment_id INTEGER NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
    friend_id        INTEGER NOT NULL REFERENCES friends(id),
    score            INTEGER CHECK (score BETWEEN 1 AND 10),
    comment          TEXT NOT NULL DEFAULT '',
    visit_date       TEXT,
    photo_filename   TEXT,
    photo_thumb_filename TEXT,
    created_at       TEXT NOT NULL,
    updated_at       TEXT NOT NULL
  );
  CREATE INDEX idx_reviews_establishment ON reviews(establishment_id);
  CREATE INDEX idx_reviews_friend ON reviews(friend_id);
  `,

  /*
   * 2: solo dos categorías principales, características adicionales, cuestionario, calificaciones
   * por aspecto, enlace de Google Maps, disponibilidad y productos de temporada.
   * Reconstruye la tabla para quitar 'ambas' y permitir guardar con datos parciales. Corre con las
   * llaves foráneas desactivadas: de lo contrario DROP TABLE borraría en cascada las filas hijas.
   */ `
  CREATE TABLE establishments_new (
    id             INTEGER PRIMARY KEY,
    name           TEXT NOT NULL CHECK (length(trim(name)) > 0),
    type           TEXT NOT NULL CHECK (type IN ('cafeteria', 'panaderia')),
    address        TEXT NOT NULL DEFAULT '',
    neighborhood   TEXT NOT NULL DEFAULT '',
    latitude       REAL CHECK (latitude BETWEEN -90 AND 90),
    longitude      REAL CHECK (longitude BETWEEN -180 AND 180),
    visit_status   TEXT NOT NULL DEFAULT 'pendiente' CHECK (visit_status IN ('visitado', 'pendiente')),
    visit_date     TEXT,
    description    TEXT NOT NULL DEFAULT '',
    in_passport    INTEGER NOT NULL DEFAULT 0 CHECK (in_passport IN (0, 1)),
    offers_drinks  INTEGER NOT NULL DEFAULT 1 CHECK (offers_drinks IN (0, 1)),
    offers_food    INTEGER NOT NULL DEFAULT 0 CHECK (offers_food IN (0, 1)),
    offers_desserts INTEGER NOT NULL DEFAULT 0 CHECK (offers_desserts IN (0, 1)),
    offers_sugar_free INTEGER NOT NULL DEFAULT 0 CHECK (offers_sugar_free IN (0, 1)),
    google_maps_url TEXT,
    google_place_id TEXT,
    observations   TEXT NOT NULL DEFAULT '',
    answers        TEXT NOT NULL DEFAULT '{}',
    score_cafe     INTEGER CHECK (score_cafe BETWEEN 1 AND 10),
    score_ambiente INTEGER CHECK (score_ambiente BETWEEN 1 AND 10),
    score_precios  INTEGER CHECK (score_precios BETWEEN 1 AND 10),
    score_atencion INTEGER CHECK (score_atencion BETWEEN 1 AND 10),
    is_demo        INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0, 1)),
    created_at     TEXT NOT NULL,
    updated_at     TEXT NOT NULL,
    CHECK ((latitude IS NULL) = (longitude IS NULL))
  );

  INSERT INTO establishments_new
    (id, name, type, address, neighborhood, latitude, longitude, visit_status, visit_date, description,
     in_passport, offers_drinks, offers_food, offers_desserts, google_maps_url, is_demo, created_at, updated_at)
  SELECT
    id, name, CASE type WHEN 'ambas' THEN 'cafeteria' ELSE type END,
    CASE WHEN address GLOB 'https://share.google/*' OR address GLOB 'https://maps.app.goo.gl/*'
        OR address GLOB 'https://goo.gl/maps/*' OR address GLOB 'https://www.google.*/maps*'
        OR address GLOB 'https://maps.google.*' THEN '' ELSE address END,
    neighborhood, latitude, longitude,
    visit_status, visit_date, description, in_passport, offers_drinks, offers_food, offers_desserts,
    -- Un enlace escrito como dirección pasa a su propio campo si es de Google Maps.
    CASE
      WHEN address GLOB 'https://share.google/*' OR address GLOB 'https://maps.app.goo.gl/*'
        OR address GLOB 'https://goo.gl/maps/*' OR address GLOB 'https://www.google.*/maps*'
        OR address GLOB 'https://maps.google.*'
      THEN trim(address)
    END,
    is_demo, created_at, updated_at
  FROM establishments;

  DROP TABLE establishments;
  ALTER TABLE establishments_new RENAME TO establishments;

  ALTER TABLE photos ADD COLUMN category TEXT NOT NULL DEFAULT 'lugar'
    CHECK (category IN ('lugar', 'bebidas', 'comida', 'postres'));
  ALTER TABLE reviews ADD COLUMN answers TEXT NOT NULL DEFAULT '{}';

  CREATE TABLE availability_items (
    id               INTEGER PRIMARY KEY,
    establishment_id INTEGER NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
    product_name     TEXT NOT NULL CHECK (length(trim(product_name)) > 0),
    note             TEXT NOT NULL DEFAULT '',
    available_when   TEXT NOT NULL DEFAULT '',
    sells_out_fast   INTEGER NOT NULL DEFAULT 0 CHECK (sells_out_fast IN (0, 1)),
    created_at       TEXT NOT NULL
  );
  CREATE INDEX idx_availability_establishment ON availability_items(establishment_id);

  CREATE TABLE seasonal_products (
    id               INTEGER PRIMARY KEY,
    establishment_id INTEGER NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
    name             TEXT NOT NULL CHECK (length(trim(name)) > 0),
    tried_on         TEXT NOT NULL,
    note             TEXT NOT NULL DEFAULT '',
    status           TEXT NOT NULL CHECK (status IN ('disponible', 'temporal')),
    photo_filename   TEXT,
    photo_thumb_filename TEXT,
    created_at       TEXT NOT NULL
  );
  CREATE INDEX idx_seasonal_establishment ON seasonal_products(establishment_id);
  `,

  /* 3: lo que consumí en la visita, como parte de mis notas. */ `
  ALTER TABLE establishments ADD COLUMN consumed_drink TEXT NOT NULL DEFAULT '';
  ALTER TABLE establishments ADD COLUMN consumed_food TEXT NOT NULL DEFAULT '';
  ALTER TABLE establishments ADD COLUMN consumed_dessert TEXT NOT NULL DEFAULT '';
  `,

  /*
   * 4: calificaciones de bebidas y comida, lo que pidió cada amigo, y se retiran del cuestionario
   * las respuestas "postres de temporada" y "bebidas especiales".
   */ `
  ALTER TABLE establishments ADD COLUMN score_bebidas INTEGER CHECK (score_bebidas BETWEEN 1 AND 10);
  ALTER TABLE establishments ADD COLUMN score_comida INTEGER CHECK (score_comida BETWEEN 1 AND 10);
  ALTER TABLE reviews ADD COLUMN ordered TEXT NOT NULL DEFAULT '';

  UPDATE establishments SET answers = json_set(answers, '$.productos', json((
    SELECT json_group_array(value) FROM json_each(answers, '$.productos')
    WHERE value NOT IN ('postres_temporada', 'especiales')
  ))) WHERE CASE WHEN json_valid(answers) THEN json_type(answers, '$.productos') END = 'array';

  UPDATE reviews SET answers = json_set(answers, '$.productos', json((
    SELECT json_group_array(value) FROM json_each(answers, '$.productos')
    WHERE value NOT IN ('postres_temporada', 'especiales')
  ))) WHERE CASE WHEN json_valid(answers) THEN json_type(answers, '$.productos') END = 'array';
  `,


  /* 5: juegos de mesa y bebidas de temporada, para filtrar junto con las bebidas sin azúcar. */ `
  ALTER TABLE establishments ADD COLUMN offers_board_games INTEGER NOT NULL DEFAULT 0 CHECK (offers_board_games IN (0, 1));
  ALTER TABLE establishments ADD COLUMN offers_seasonal_drinks INTEGER NOT NULL DEFAULT 0 CHECK (offers_seasonal_drinks IN (0, 1));
  `,
];

export const LATEST_SCHEMA_VERSION = migrations.length;
