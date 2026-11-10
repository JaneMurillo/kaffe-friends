# Los Amigos del Kaffe

*One coffee at a time.*

A personal guide for discovering, rating and remembering the best coffee shops and bakeries in Guadalajara, Jalisco. It is a private, single-user application that runs on your own computer: no hosting and no cloud. Google services are optional.

> The user interface is in Spanish. This document describes the project in English; Spanish UI labels are quoted where they help you find something in the app.

**Stack:** React 19 · TypeScript · Vite · Node.js · Express 5 · SQLite · Leaflet + OpenStreetMap · sharp · Zod · Vitest · Playwright

---

## Table of contents

1. [Project requirements](#project-requirements)
2. [Installation and usage](#installation-and-usage)
3. [Your data](#your-data)
4. [Features](#features)
5. [Scoring rules](#scoring-rules)
6. [Architecture](#architecture)
7. [Development and testing](#development-and-testing)
8. [Known limitations](#known-limitations)

---

## Project requirements

The application was built against the following requirements.

### Functional requirements

| # | Requirement |
|---|---|
| F1 | Catalog coffee shops and bakeries in Guadalajara. Each place belongs to one category (**coffee shop** or **bakery**); food, desserts and sugar-free drinks are additional attributes, not categories. |
| F2 | Provide dedicated sections: home, full directory, Top ranking, coffee shops only, bakeries only, Guadalajara Passport and map. |
| F3 | Show each place as an editorial profile: information and cover photo, ratings, photos by type, personal notes, availability, seasonal products, friends' reviews and location. Optional sections appear only when they contain data. |
| F4 | Allow partial saves: a name is the only required field. The profile indicates what is missing and links to complete it. A place marked as *pending* does not ask for a visit date or ratings. |
| F5 | Use a step-by-step form: the place, my opinion, ratings, location and photos. |
| F6 | Include a quick questionnaire of eight one-tap questions that are converted into tags. Friends answer a shorter version. |
| F7 | Keep three independent scores: my rating, friends' average and community rating (see [Scoring rules](#scoring-rules)). Unrated aspects are excluded and never count as zero. |
| F8 | The Top ranking uses **only** my own ratings. The community ranking is a separate view. Ties share the same position (1, 2, 2, 4). |
| F9 | Friends' reviews without user accounts: quick options, optional comment, editing, a photo, and a review history per person. |
| F10 | Guadalajara Passport: visit stamps with automatically calculated progress. |
| F11 | Interactive map with place markers, filters and a location picker (click, drag, typed address, or pasted coordinates). |
| F12 | Search and filters: accent-insensitive name search, category, rating, passport, food and desserts; sorting by name, date or rating; card or list view. Filters live in the URL so they survive a page reload. |
| F13 | Photos: multiple upload, a main photo, an expandable gallery and automatic optimization. |
| F14 | Import a place from a Google Maps link, filling in only the data that can actually be obtained. Data is never invented: missing fields stay empty, the user is notified, and everything can be edited by hand. |
| F15 | Create, download and restore backups (database plus all photos) from within the app. |
| F16 | Optional sample data that can be added and removed without touching real data. |

### Non-functional requirements

| Area | Requirement |
|---|---|
| **Deployment** | Runs locally on Windows with a double click (`instalar.bat`, `iniciar.bat`); no hosting and no cloud. Internet is required only for map tiles. |
| **Privacy** | By default the server listens only on `127.0.0.1`. Personal data (database, photos, backups) lives in `data/` and is **never** committed to the repository. Photo metadata, including phone GPS, is stripped. |
| **Security** | Opening the app to other devices requires a password, enforced at startup. Cross-origin writes and unknown hosts are rejected. The Google API key stays on the server and never reaches the browser. |
| **Data integrity** | Constraints are enforced in the database itself (`CHECK`, foreign keys, paired coordinates). Restores are validated before anything is changed, and schema migrations back up the database first. |
| **Accessibility** | WCAG 2.1 A and AA: full keyboard support, visible focus, native `<dialog>`, `prefers-reduced-motion`, and text colors that meet a 4.5:1 contrast ratio, verified by automated axe audits. |
| **Responsiveness** | Usable on desktop, tablet and mobile, including from a phone on the same Wi-Fi network. |
| **Independence** | Fonts are bundled with the project; no external font or CDN services. Heavy libraries (Leaflet) are loaded on demand. |
| **Quality** | Strict TypeScript on client and server, input validation with Zod, unit and API tests, and end-to-end tests in a real browser. Tests never touch the real `data/` folder. |
| **Compliance** | Respect Google Places API pricing and storage policies and the OpenStreetMap tile usage policy (see [Known limitations](#known-limitations)). |

---

## Installation and usage

You need [Node.js](https://nodejs.org) 18.17 or later. The project was tested with Node 18.17.1 on Windows 11. Node 18 no longer receives security updates, so upgrading to a current LTS release is recommended; after switching versions, run the installation again.

### On Windows, with a double click

1. Run `instalar.bat` (first time only, and after updating the code).
2. Run `iniciar.bat`. The browser opens at <http://localhost:5050>.
3. To stop the application, close the console window. Your data stays saved.

### From the command line

```bash
npm run setup     # install dependencies and build
npm start         # start at http://localhost:5050
```

Open that address in Chrome or any other browser. An internet connection is only needed for map tiles; everything else works offline.

### Optional configuration

Copy `.env.example` to `.env` to change the port, the listening address or the data folder, and to enable the two options below.

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `5050` | Local server port. |
| `HOST` | `127.0.0.1` | Listening address. Use `0.0.0.0` to allow other devices on your network. |
| `APP_PASSWORD` | *(empty)* | Required whenever `HOST` is not `127.0.0.1`. |
| `GOOGLE_MAPS_API_KEY` | *(empty)* | Enables Places API (New) lookups for Google Maps links. |
| `DATA_DIR` | `data` | Folder for the database, photos and backups (relative or absolute). |

### Opening the guide from your phone

The guide lives on your computer, so the computer must be on with the app running, and the phone must be on the same Wi-Fi network.

1. In `.env`, set `HOST=0.0.0.0` and `APP_PASSWORD=a-long-password`. Without a password, the server refuses to start.
2. Run `iniciar.bat`. The console window shows the address to use on the phone (for example `http://192.168.1.20:5050`).
3. If Windows asks, allow access on **private networks** only.

Traffic inside your network is not encrypted (HTTP), so use it on your home Wi-Fi, not on public networks. To access it from outside your home, use a personal VPN such as Tailscale; **do not open the port on your router**.

### Google Maps links

When adding a place, paste its link and the app fills in whatever can be obtained. Data is never invented: anything missing stays empty and you are notified. Everything can be corrected by hand.

| Link | Without an API key | With an API key |
|---|---|---|
| `google.com/maps/place/…` | Name and coordinates | Also address and neighborhood |
| `maps.app.goo.gl/…` | Whatever the link resolves to; usually name and coordinates | Also address and neighborhood |
| `share.google/…` | Name only | Name, address, neighborhood and coordinates |

To enable the key:

1. In [Google Cloud](https://console.cloud.google.com/), create a project with billing and enable **Places API (New)**.
2. Create a key and restrict it to that API. It is used from the server, so do not add a website restriction.
3. Run `configurar-google.bat` (or `npm run google:setup`) and paste the key. It is tested against Google and saved to `.env` only if it works.
4. Restart the application. The key never reaches the browser, and `.env` is never committed to Git.

**Before enabling it, keep in mind:** every lookup may incur a cost (check the [pricing](https://mapsplatform.google.com/pricing/) and set a budget on the project). In addition, the [Places API policies](https://developers.google.com/maps/documentation/places/web-service/policies) only allow the place ID to be stored indefinitely, limit coordinate caching to 30 days, and ask that names and addresses not be copied. This application stores whatever you accept in the form, so using Places to fill your guide permanently does not fully comply with those policies. Without a key, no Places API requests are made.

---

## Your data

Everything lives in the `data/` folder, which Git ignores so it never reaches the public repository:

```
data/
├── kaffe.db       SQLite database
├── uploads/       optimized photos (places, reviews and seasonal products)
└── backups/       ZIP backups
```

### Backup and restore

From **Respaldos y restauración** (Backups and restore, linked in the footer) you can create, download and restore backups. Each ZIP contains the full database and every photo.

- **Restoring is safe:** the file is validated before anything is touched (origin, paths, database integrity), and an `antes-de-restaurar` (before-restore) backup of the current state is created automatically.
- **Upgrading is safe:** schema changes are applied through incremental migrations, and a copy of the database is saved to `data/backups/antes-de-migrar-*.db` before migrating.
- **Keep an off-computer copy:** a backup inside `data/` does not protect you from a disk failure. Download one from time to time and store it on a USB drive or elsewhere.

### Sample data (optional)

The application starts empty. To see it with content:

```bash
npm run demo:add      # 3 fictional places, labeled "Ejemplo ficticio" (fictional example)
npm run demo:remove   # removes them without touching your real data
```

The samples have no coordinates because the places do not exist, so they do not appear on the map.

---

## Features

- **Sections:** home, full directory, Top, coffee shops only, bakeries only, Guadalajara Passport and map.
- **Categories:** coffee shop or bakery. Food, desserts and sugar-free drinks are additional attributes.
- **Editorial profile:** information and photo, ratings, photos by type, personal notes, availability, seasonal products, friends' reviews and location. Optional sections appear only when they contain data.
- **Quick questionnaire:** eight one-tap questions that become tags. Friends answer a shorter version.
- **Partial saves:** a name is enough; the profile shows what is missing and links to complete it.
- **Search and filters:** by name (accent-insensitive), category, rating, passport, food and desserts; sorting by name, date or rating; card or list view. Filters are stored in the URL, so they survive a reload.
- **Step-by-step form:** the place, my opinion, ratings, location and photos. A pending place does not ask for a date or ratings.
- **Three independent scores:** my rating, friends' average and community rating.
- **Separate rankings:** the Top uses only my ratings; the community ranking is a different view.
- **Friends' reviews:** no accounts, quick options, optional comment, editing, a photo and per-person history.
- **Passport:** visit stamps and automatically calculated progress.
- **Map:** markers with place cards, filters, and location picking by click, drag, typing or pasting coordinates.
- **Photos:** multiple upload, main photo, expandable gallery and automatic optimization.

---

## Scoring rules

Implemented in `server/src/services/scores.service.ts` as pure functions with tests.

| Score | Calculation |
|---|---|
| **My rating (overall)** | Average of the rated aspects among coffee, drinks, food, ambiance, prices and service; food counts only if the place offers it. Coffee 9 and service 8 give **8.5**. Unrated aspects are excluded and never count as zero. If a place only has legacy ratings for drinks, food and desserts, their average is used until a new aspect is rated. |
| **Friends' average** | Average of the reviews that include a rating. |
| **Community** | Average of my rating and each rated review, with equal weight per person. My 8 with friends' 10, 6 and 10 gives **8.5**. |

Reviews are stored in a table separate from my ratings, and the Top reads only `scores.personal`. Ties share a position (1, 2, 2, 4).

---

## Architecture

```
├── client/                  React + TypeScript UI
│   └── src/
│       ├── components/      Reusable components grouped by domain
│       │   ├── establishments/  forms/  layout/  map/  reviews/  ui/
│       ├── hooks/           Data loading and document title
│       ├── pages/           One view per route
│       ├── services/api.ts  Single point of contact with the backend
│       ├── styles/          Design tokens and per-area stylesheets
│       ├── types/           API contracts
│       └── utils/           Date, label and number formatting
├── server/                  Express REST API
│   ├── src/
│   │   ├── routes/          URL-to-controller mapping
│   │   ├── controllers/     Translate HTTP into service calls
│   │   ├── services/        Business rules, images, backups, Google Maps
│   │   ├── models/          All SQL
│   │   ├── db/              Connection and migrations
│   │   ├── validation/      Zod input schemas
│   │   ├── middleware/      Security, auth, uploads and errors
│   │   └── scripts/         Sample data and Google key setup
│   └── tests/               Unit and API tests
├── e2e/                     Real-browser tests and accessibility audit
└── data/                    Your data (not versioned)
```

### Data model

```
establishments 1─┬─* ratings    (legacy ratings: drinks, food, desserts)
                 ├─* photos     (partial unique index: a single main photo)
                 ├─* availability_items
                 ├─* seasonal_products
                 └─* reviews *─1 friends
```

Integrity is also enforced in the database: `CHECK` constraints on ranges and values, foreign keys with `ON DELETE CASCADE`, and latitude and longitude required together.

### Technical decisions

- **Filtering in the service layer, not in SQL:** SQLite does not natively compare strings ignoring accents, and a personal guide has few records. Loading avoids the N+1 problem with four queries.
- **Images rewritten with sharp:** verifies the file is really an image, generates WebP gallery and thumbnail versions, and strips metadata, including GPS data from phone photos.
- **Privacy:** by default the server listens only on `127.0.0.1` and rejects writes from other origins and unknown hosts. Exposing it to other devices requires a password, which protects data, photos and backups with an `HttpOnly` cookie.
- **Google Maps links:** the server only follows `https` Google addresses and validates every redirect. The camera center (`@lat,lng`) is never taken as the place's location.
- **Bundled fonts:** Newsreader and Figtree are served from the project, with no dependency on external services.
- **On-demand Leaflet:** loaded only in views that display a map.

### Accessibility

Native controls with full keyboard support, visible focus, dialogs built on `<dialog>`, `prefers-reduced-motion` support, and an automated axe audit (WCAG 2.1 A and AA) on the main views.

The caramel `#B98252` and sage `#89917A` brand colors do not reach 4.5:1 on light backgrounds, so they are used only decoratively. Text uses darker variants of the same hues, defined in `client/src/styles/tokens.css`.

---

## Development and testing

```bash
npm run dev         # Vite at http://localhost:5173 with hot reload, API on :5050
npm run typecheck   # TypeScript on client and server
npm test            # unit and API tests (temporary data folder)

# Real-browser tests. First time: npx playwright install chromium
npm run build && npm run test:e2e
```

Tests use temporary folders and never touch `data/`.

---

## Known limitations

- **Maps:** OpenStreetMap tiles require internet access, and the public tile server has a [usage policy](https://operations.osmfoundation.org/policies/tiles/) intended for light traffic, which suits personal use. Publishing the app for many users would require a different tile provider.
- **Address lookup:** without a Google key, any address not included in the link must be typed manually, and the location is chosen on the map or by pasting coordinates.
- **iPhone HEIC photos:** not supported; convert them to JPG before uploading. The app shows a message explaining this.
- **Private use:** designed for a single person. Even with a password, do not expose it directly to the internet.

---

**Author:** Jeanette Murillo
