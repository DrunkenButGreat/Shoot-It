# PhotoShoot Organizer

Professionelles Self-Hosted Tool zur Organisation von Fotoshootings.

## Features

- 🔐 **Sichere Authentifizierung** - Lokaler Login + Google OAuth (optional)
- 📁 **Projektverwaltung** - Übersichtliche Organisation aller Shootings
- 🎨 **Moodboards** - Masonry-Galerien mit Gruppen & Kommentaren
- 👥 **Teilnehmerverwaltung** - Kontakte, Rollen & Bilder
- 📝 **Verträge** - Markdown-Editor mit digitaler Unterschrift
- 📞 **Callsheets** - Professionelle Shooting-Pläne mit PDF-Export
- ⭐ **Auswahl-Galerie** - Bewertung mit Sternen & Farbmarkierungen
- 🖼️ **Ergebnisse** - Ordnerstruktur mit Download-Optionen
- 🔗 **Öffentliche Links** - Kurz-URLs für Kunden ohne Login

## Tech Stack

- **Runtime**: Node.js 24 LTS
- **Frontend**: Next.js 16, TypeScript 5.9, Tailwind CSS 4
- **Backend**: Next.js API Routes, Prisma 7
- **Datenbank**: PostgreSQL 18
- **Auth**: Auth.js v5 (NextAuth)
- **Container**: Docker & Docker Compose

## Quick Start

### Voraussetzungen

- Docker & Docker Compose
- (Optional) Google OAuth Credentials

### Installation

```bash
# Repository klonen
git clone <repository-url>
cd photoshoot-organizer

# Environment einrichten
cp .env.example .env

# .env bearbeiten und Werte setzen:
# - DB_PASSWORD (sicheres Passwort generieren: openssl rand -base64 32)
# - AUTH_SECRET (openssl rand -base64 32)
# - Optional: AUTH_GOOGLE_ID und AUTH_GOOGLE_SECRET

# Container starten
docker compose up -d

# Datenbank initialisieren
docker compose exec app npx prisma migrate deploy

# Optional: Admin-User erstellen
docker compose exec app npx prisma db seed
```

Die Anwendung ist nun unter `http://localhost:3000` erreichbar.

### Befehle

```bash
# Status prüfen
docker compose ps

# Logs anzeigen
docker compose logs -f app

# Stoppen
docker compose down

# Stoppen + Daten löschen
docker compose down -v

# Neustart
docker compose restart

# Updates einspielen
git pull
docker compose up -d --build
docker compose exec app npx prisma migrate deploy
```

## Konfiguration

### Zentrale Einstellungen

Alle Anpassungen (Farben, Logo, Limits) erfolgen in `config/`:

| Datei | Beschreibung |
|-------|--------------|
| `app.config.ts` | App-Einstellungen, Limits, Features |
| `theme.config.ts` | Farben, Fonts, Branding |
| `export.config.ts` | Export-Optionen für PDF, ZIP, CSV |

### Branding anpassen

1. Logo austauschen: `public/logo.svg`
2. Favicon: `public/favicon.ico`
3. Farben in `src/app/globals.css` im `@theme` Block anpassen

### Authentifizierung

**Lokaler Login (Standard):**
- E-Mail/Passwort Authentifizierung
- Keine externe Abhängigkeit
- Users werden in der Datenbank gespeichert

**Google OAuth (Optional):**
1. Google Cloud Console: https://console.cloud.google.com/apis/credentials
2. OAuth 2.0 Client-ID erstellen
3. Authorized redirect URI: `{AUTH_URL}/api/auth/callback/google`
4. `AUTH_GOOGLE_ID` und `AUTH_GOOGLE_SECRET` in `.env` setzen

## Projektstruktur

```
├── config/           # Zentrale Konfiguration
├── prisma/           # Datenbank-Schema & Migrationen
├── public/           # Statische Assets (Logo, Favicon)
├── src/
│   ├── app/          # Next.js App Router
│   ├── auth.ts       # Auth.js Konfiguration
│   ├── components/   # React Komponenten
│   ├── lib/          # Utilities & Helpers
│   ├── hooks/        # Custom React Hooks
│   └── types/        # TypeScript Definitionen
├── uploads/          # Hochgeladene Dateien (Docker Volume)
└── local_media/      # Lokaler Import-Ordner
```

## Lokaler Ordner-Import

Für den Import von Bildern direkt vom Server:

1. Ordner in `.env` konfigurieren: `LOCAL_MEDIA_PATH=/pfad/zum/ordner`
2. Container neu starten
3. In der Auswahl-Galerie oder Ergebnissen "Lokalen Ordner importieren" wählen

Der Ordner wird read-only in den Container gemountet.

## Sicherheit

- Alle Passwörter in `.env` sicher generieren
- In Produktion HTTPS verwenden (Reverse Proxy)
- `.env` niemals committen
- Regelmäßige Backups erstellen

## Backup & Restore

```bash
# Datenbank-Backup
docker compose exec db pg_dump -U photoshoot photoshoot_db > backup.sql

# Datenbank-Restore
docker compose exec -T db psql -U photoshoot photoshoot_db < backup.sql

# Uploads sichern
docker cp photoshoot-app:/app/uploads ./uploads-backup

# Uploads wiederherstellen
docker cp ./uploads-backup/. photoshoot-app:/app/uploads/
```

## Entwicklung

```bash
# Lokale Entwicklung (ohne Docker)
npm install
npm run dev

# Prisma Studio (Datenbank-GUI)
npm run db:studio

# Linting
npm run lint

# Formatierung
npm run format
```

## API Dokumentation

Die API ist unter `/api/` verfügbar. Wichtige Endpoints:

| Endpoint | Beschreibung |
|----------|--------------|
| `GET /api/health` | Health Check |
| `GET /api/projects` | Projektliste |
| `POST /api/projects` | Projekt erstellen |
| `GET /api/projects/[id]` | Projekt-Details |
| `GET /api/projects/[id]/moodboard` | Moodboard |
| `GET /api/projects/[id]/selection` | Auswahl-Galerie |

Vollständige API-Dokumentation: siehe `SPECIFICATION.md`

## Troubleshooting

**Container startet nicht:**
```bash
docker compose logs app
```

**Datenbank-Verbindungsfehler:**
```bash
docker compose exec app npx prisma db push
```

**Prisma Client outdated:**
```bash
docker compose exec app npx prisma generate
docker compose restart app
```

## Lizenz

MIT License - siehe [LICENSE](LICENSE)
