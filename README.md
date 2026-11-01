# PhotoShoot Organizer

A comprehensive self-hosted web application for managing photoshoot projects, built with Next.js 16, TypeScript, and PostgreSQL.

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16.4-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-6.19-2D3748)](https://www.prisma.io/)

Optional Pocket ID sign-in can be configured in the administration UI. See the [setup and upgrade guide](deploy/POCKET-ID.md).

## 🎯 Overview

PhotoShoot Organizer is a self-hosted platform designed specifically for photographers and creative teams to manage all aspects of photoshoots, from initial planning to final delivery.

**Current version: 1.27.0.** See [CHANGELOG.md](CHANGELOG.md) for release changes and the [upgrade guide](deploy/UPDATES.md) for deployment and recovery.

## ✨ Features

### Available features

- **Authentication & Authorization**
  - Local email/password login with bcrypt
  - Google OAuth and optional Pocket ID sign-in
  - JWT session management
  - Role-based access control (Owner/Editor/Viewer)

- **Project Management**
  - Create, read, update, and delete projects
  - Dashboard with project grid view
  - Public short URLs for sharing
  - Search and filter capabilities
  - Project statistics and counts
  - Localized storage sizes on project cards, including shared projects
  - Personal storage overview with an expandable ranking of owned projects; shared projects are excluded from the personal total

- **Participants Module**
  - Manage models, stylists, makeup artists, and crew
  - Contact information (email, phone, role)
  - Click-to-call and click-to-email functionality
  - Notes and custom fields

- **Moodboard Module**
  - Create groups to organize inspiration
  - Status workflow (PENDING → ACCEPTED/REJECTED)
  - Comment system with user attribution
  - Color-coded status badges

- **Selection Gallery**
  - 5-star rating system (1-5 stars)
  - Color labeling (RED/YELLOW/GREEN)
  - Advanced filtering by stars and colors
  - Grid, masonry, justified and list rendering; internal grid/masonry/list controls and public view selection
  - Sorting by import order, filename or EXIF capture date (oldest/newest first)
  - Quick rating updates in image and list views

- **Contracts Module**
  - Create and manage contracts
  - Digital signature pad with canvas
  - Multiple signatures per contract
  - Signature tracking (IP, timestamp, user agent)
  - PDF export ready

- **Callsheet Module**
  - Shooting schedule management
  - Location details and parking info
  - Emergency contacts
  - Equipment list
  - Timeline visualization ready

- **Results Module**
  - Folder hierarchy for organizing final images
  - Folder creation and management
  - Image upload to folders
  - Download capabilities

### Gallery controls and uploads

- **Image size:** use the slider above selection, results, moodboards and public
  overview galleries to resize previews from **75% to 200%** in 5% steps. At
  **100%**, the existing default sizes are used. Larger tiles show fewer columns;
  layouts wrap to fit narrow screens without horizontal scrolling.
- **Personal preference:** the size is shared across galleries and remembered in
  the current browser. Other visitors keep their own preference. If browser
  storage is blocked, resizing still works for the current session.
- **List view:** selection galleries retain previews, selection and ratings, plus
  permitted download/delete actions. The size slider is hidden in list views;
  fullscreen previews and original downloads are independent of the slider.
- **Capture-date sorting:** selection galleries can sort oldest or newest first
  using the original EXIF capture date. Images without a date stay at the end.
  New selection uploads and local imports extract this automatically; see
  [existing-image upgrades](#capture-dates-for-existing-selection-images).
- **Loading more:** internal and public selection/results galleries and public
  image galleries reveal the next 100 images as you approach the end. A manual
  load-more button remains available. Appended images retain row order.
- **Uploads:** moodboards, selection, results and profile branding show overall
  progress, completed-file counts, estimated remaining time and a separate
  processing state. Uploads use bounded concurrency and retry handling.
- **Languages:** gallery controls and progress messages are available in German
  (default) and English.

## 🏗️ Architecture

### Technology Stack

- **Frontend:**
  - Next.js 16.4 (App Router)
  - React 19
  - TypeScript 5.7
  - Tailwind CSS 3.4
  - shadcn/ui components

- **Backend:**
  - Next.js API Routes
  - Prisma 6.19 ORM
  - PostgreSQL 18
  - Auth.js v5 (NextAuth)

- **Infrastructure:**
  - Docker Compose
  - Node.js 24 LTS
  - Multi-stage Docker builds

- **Image Processing:**
  - Sharp (thumbnails, optimization)
  - Metadata extraction
  - MIME type validation

### Project Structure

```
/
├── src/config/              # Configuration files
│   ├── app.config.ts        # App settings and limits
│   ├── theme.config.ts      # Branding and colors
│   └── export.config.ts     # Export settings
├── prisma/
│   └── schema.prisma        # Database schema and additive migrations
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── api/             # API routes
│   │   ├── login/           # Authentication pages
│   │   ├── dashboard/       # Dashboard
│   │   └── project/[id]/    # Project pages
│   ├── auth.ts              # Auth.js configuration
│   ├── proxy.ts             # Route protection
│   ├── components/          # React components
│   │   ├── auth/            # Authentication components
│   │   ├── projects/        # Project components
│   │   ├── participants/    # Participant components
│   │   ├── moodboard/       # Moodboard components
│   │   ├── selection/       # Selection components
│   │   └── ui/              # shadcn/ui components
│   ├── lib/                 # Utilities
│   │   ├── prisma.ts        # Database client
│   │   ├── validations.ts   # Zod schemas
│   │   ├── permissions.ts   # Access control
│   │   ├── file-utils.ts    # File handling
│   │   ├── image-processing.ts  # Image utilities
│   │   └── shortcode.ts     # URL shortening
│   └── types/               # TypeScript definitions
├── docker-compose.yml       # Container orchestration
├── Dockerfile               # Multi-stage build
├── package.json
└── tsconfig.json
```

## 🚀 Quick Start

### Prerequisites

- Docker and Docker Compose (recommended)
- OR Node.js 24 LTS + PostgreSQL 18

### Installation

1. **Clone the repository:**
```bash
git clone https://github.com/DrunkenButGreat/Shoot-It.git
cd Shoot-It
```

2. **Set up environment variables:**
```bash
cp .env.example .env
```

Edit `.env` and configure:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/shootit"
AUTH_SECRET="your-secret-key-here"
NEXTAUTH_URL="http://localhost:3000"
# Optional: Google OAuth
GOOGLE_CLIENT_ID="your-client-id"
GOOGLE_CLIENT_SECRET="your-client-secret"
```

3. **Start with Docker (Recommended):**
```bash
docker compose up -d
```

The application will be available at http://localhost:3000

4. **OR Start locally:**
```bash
# Install dependencies
npm install

# Start PostgreSQL
docker compose up -d db

# Run migrations
npx prisma migrate dev

# Generate Prisma client
npx prisma generate

# Start development server
npm run dev
```

### QNAP / Container Station updates (1.16.0+)

For a manual update, replace **only the app container** with
`ghcr.io/drunkenbutgreat/shoot-it:1.16.0`, retaining its existing environment,
network and `/app/uploads` volume. Use the image's default start command (no extra
command). It automatically backs up and migrates stock 1.8.x–1.11.x databases;
fresh/already migrated databases apply regular migrations. Keep the existing DB
container and storage mounts. See [startup migration and recovery](deploy/QNAP-UPDATES.md#automatic-migration-at-app-start-1160).

For automatic image updates, use the [standalone update container](deploy/QNAP-UPDATES.md): create a separate
Container Station application from [this YAML](deploy/docker-compose.updater.yml).
It detects the installed version, backs up the live database/uploads, applies the
necessary 1.11 schema upgrade and migration baseline, and installs the latest
compatible release. Host Python, systemd, Compose commands and a checkout are not
required. Choose `check`, `run` (one-time) or `watch` (automatic). The existing
database container and its volumes remain in place. Requires a published 1.15.0+
release; read the NAS guide for supported engines and manual-update settings.

With updater/release **1.16.0+**, use the extra command `migrate` (YAML:
`command: ["migrate"]`) to upgrade only the database from stock 1.8.x/1.9.x/1.10.x.
It takes a database-only backup and leaves the old app stopped for manual image
replacement; uploads and the app image are not changed. See the
[migration-only instructions](deploy/QNAP-UPDATES.md#database-migration-only-updater-and-release-1160).

### Manual Docker Compose updates

Manual updates remain the default. After taking a backup, update the app with:

```sh
docker compose pull app
docker compose up -d --no-deps --wait --wait-timeout 120 app
```

The default `latest` image follows tested stable releases. Migrations run at app
startup. No updater, Python or systemd is required for this manual path. For a
specific version, set `SHOOT_IT_IMAGE=ghcr.io/drunkenbutgreat/shoot-it:<version>` in
`.env`. See [manual updates and switching modes](deploy/UPDATES.md#manual-updates-without-the-updater)
before switching back from automatic updates.

For automatic updates, use the same [Docker updater](deploy/docker-compose.updater.yml)
on Linux and QNAP: `watch` enables scheduled checks, `run` performs a single update.
Manual updates and app-start migrations remain available without it. If the old
host/systemd updater was installed, [disable its timer before switching](deploy/UPDATES.md#retire-an-existing-host-updater).

### Initial Setup

1. Navigate to http://localhost:3000
2. Click "Sign Up" to create your first user account
3. Start creating projects!

## 📊 Database Schema

The Prisma schema covers these main areas:

- **Authentication:** User, Account, Session, VerificationToken, PocketIdSettings
- **Administration:** RegistrationSettings, RegistrationInvite, SiteSettings
- **Projects:** Project, ProjectAccess, ProjectVisit
- **Moodboard:** MoodboardGroup, ProjectMoodboardLink, MoodboardImage, Comment
- **Participants:** Participant, ParticipantImage, ParticipantField
- **Contracts:** Contract, ContractSignature
- **Callsheet:** Callsheet, CallsheetScheduleItem
- **Selection:** SelectionImage (including optional capture date), SelectionFolder, ImageRating
- **Results:** ResultFolder, ResultFile
- **Applications and scheduling:** ProjectApplication, ApplicationImage, AppointmentSlot, AppointmentResponse
- **Media cleanup:** FileCleanupJob

## 🔌 API Endpoint Examples

### Projects API (5 endpoints)
```
GET    /api/projects                    # List projects
POST   /api/projects                    # Create project
GET    /api/projects/[id]               # Get project
PUT    /api/projects/[id]               # Update project
DELETE /api/projects/[id]               # Delete project
```

### Participants API (4 endpoints)
```
GET    /api/projects/[id]/participants                   # List participants
POST   /api/projects/[id]/participants                   # Create participant
PUT    /api/projects/[id]/participants/[participantId]   # Update participant
DELETE /api/projects/[id]/participants/[participantId]   # Delete participant
```

### Moodboard API (5 endpoints)
```
GET    /api/projects/[id]/moodboard                             # Get groups
POST   /api/projects/[id]/moodboard/groups                      # Create group
PUT    /api/projects/[id]/moodboard/groups/[groupId]            # Update group
DELETE /api/projects/[id]/moodboard/groups/[groupId]            # Delete group
POST   /api/projects/[id]/moodboard/groups/[groupId]/comments   # Add comment
```

### Selection Gallery API (2 endpoints)
```
GET    /api/projects/[id]/selection                 # Get images (with filters)
PUT    /api/projects/[id]/selection/[imageId]/rating   # Update rating
```

### Contracts API (6 endpoints)
```
GET    /api/projects/[id]/contracts                  # List contracts
POST   /api/projects/[id]/contracts                  # Create contract
GET    /api/projects/[id]/contracts/[contractId]     # Get contract
PUT    /api/projects/[id]/contracts/[contractId]     # Update contract
DELETE /api/projects/[id]/contracts/[contractId]     # Delete contract
POST   /api/projects/[id]/contracts/[contractId]/sign  # Sign contract
```

### Callsheet API (3 endpoints)
```
GET    /api/projects/[id]/callsheet          # Get callsheet
POST   /api/projects/[id]/callsheet          # Create/update callsheet
POST   /api/projects/[id]/callsheet/schedule # Add schedule item
```

### Results API (3 endpoints)
```
GET    /api/projects/[id]/results                   # Get folder structure
POST   /api/projects/[id]/results/folders           # Create folder
DELETE /api/projects/[id]/results/folders/[folderId] # Delete folder
```

The examples above are a subset. Additional routes cover uploads, downloads,
folder operations, scheduling, administration and authentication under `src/app/api`.

## 🔐 Security Features

- **Authentication:**
  - Secure password hashing with bcrypt
  - JWT session tokens
  - OAuth 2.0 integration

- **Authorization:**
  - Role-based access control
  - Permission checks on all endpoints
  - Project-level access management

- **Input Validation:**
  - Zod schemas for all inputs
  - File type and size validation
  - MIME type verification

- **File Security:**
  - Path traversal prevention
  - Secure filename generation
  - File size limits
  - Allowed file types whitelist

- **Database:**
  - Parameterized queries (Prisma)
  - Foreign key constraints
  - Cascade deletes

## 📖 Documentation

- **[PROGRESS.md](PROGRESS.md)** - Detailed implementation progress
- **[IMPLEMENTATION.md](IMPLEMENTATION.md)** - Technical implementation guide
- **[SPECIFICATION.md](SPECIFICATION.md)** - Complete technical specification

## 🧪 Development

### Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run db:studio    # Open Prisma Studio
npm run db:push      # Prototype schemas only; use migrations for upgrades
npm run db:migrate   # Create/apply development migrations
npm run db:deploy    # Apply existing migrations without resetting data
```

### Gallery regression checks

```sh
node scripts/test-gallery-size.cjs
node scripts/test-gallery-scroll.cjs
node scripts/test-gallery-previews.cjs
node scripts/test-selection-gallery.cjs
npm run test:design
npm run lint
npm run build
```

These checks cover size persistence, blocked storage, gallery integration,
preview generation, incremental loading, EXIF dates, sorting and list actions.
The migration regression suite requires a disposable PostgreSQL database whose
name ends in `_test` and refuses the normal application database:

```sh
TEST_DATABASE_URL=postgresql://.../shootit_migrations_test npm run test:migrations
```

### Database Management

```bash
# Create a new migration
npx prisma migrate dev --name your_migration_name

# Apply migrations in production
npx prisma migrate deploy

# Reset database (development only)
npx prisma migrate reset

# Open Prisma Studio
npx prisma studio
```

### Docker Commands

```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f app

# Stop services
docker compose down

# Rebuild containers
docker compose up -d --build

# Run migrations in container
docker compose exec app npx prisma migrate deploy
```

## 🎨 UI Components

### shadcn/ui Components
- Button (with variants)
- Card (with header, content, footer)
- Dialog (modal dialogs)
- Input (form inputs)
- Label (form labels)

### Custom Components
- ProjectCard
- ProjectForm
- DashboardContent
- ParticipantCard
- ParticipantForm
- MoodboardGroup
- GroupForm
- ImageCard
- FilterBar

## 📝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- UI components from [shadcn/ui](https://ui.shadcn.com/)
- Database ORM by [Prisma](https://www.prisma.io/)
- Authentication by [Auth.js](https://authjs.dev/)
- Styled with [Tailwind CSS](https://tailwindcss.com/)

## 📞 Support

For support, please open an issue in the GitHub repository.

---

**Made with ❤️ for photographers and creative teams**

## Administration (1.17.0)

The admin dashboard is available at `/admin`, with a link on the project dashboard
for administrators. It includes user/project counts, the latest 20 users, registration
settings and the latest 50 invitation codes. Existing user accounts retain login access
in all modes. The first successfully created account becomes the **instance owner
and administrator** automatically, for both email/password and Google signups.
Later users start without administrative rights. Concurrent first registrations
produce exactly one owner. Instance ownership does not grant ownership of other
users' projects.

Version 1.17.0 promotes the oldest existing account (`createdAt`, then `id` for ties)
to owner/admin during the normal startup migration, preserving all other admin
grants and project ownership. The owner's admin access cannot be revoked with
`admin:revoke`. Existing installations therefore gain an owner when this update
is deployed; no manual account selection is needed.

For local checkouts using an existing `.env`, apply pending migrations before
starting the updated app:

```bash
node --env-file=.env scripts/migrate.cjs deploy
npm run db:generate
```

For legacy databases without migration history, use the supported startup/updater
upgrade described below instead of `db push`.

### Upgrade without data loss

The app automatically backs up and migrates supported legacy databases at startup.
Existing accounts retain their data.

Version 1.22.1 adds media lookup indexes, unique sibling-folder names and a persistent
file-cleanup queue. Existing duplicate folder names receive an ID suffix; folder IDs,
images and hierarchy are preserved. File deletions retry every minute after the
database change commits. Files still referenced elsewhere are retained. Project
storage totals may lag by up to 30 seconds. Use migrations rather than `db push`
to install the partial unique indexes.
See [updates and recovery](deploy/UPDATES.md) for the current Docker workflow.

Grant access to a specific existing account from the trusted server environment:

```bash
npm run admin:grant -- admin@example.com
# Revoke a non-owner admin immediately (also affects existing sessions):
npm run admin:revoke -- admin@example.com
```

These commands load `.env` with Node.js 22+; when environment variables are already
injected (for example Docker), use `node scripts/admin.cjs grant admin@example.com`.
For the application container: `docker compose exec app node scripts/admin.cjs grant admin@example.com`.
Use an existing account you control. The editable profile occupation (`role`) is
unrelated to admin privileges. Granting rights does not create an account.

Registration modes:
- **Open** (default): new accounts can register normally.
- **Invitation only**: one code per email/password signup; codes expire after 1–90
  days and can be revoked. Copy each code when created; only its hash is stored.
  New Google OAuth accounts must register through the invitation form instead.
- **Closed**: all new accounts are blocked, including registrations with a code
  or Google OAuth. Existing password and linked Google accounts still work.

Pending codes keep their original expiry when the mode changes. They are only
consumed by successful registrations in invitation-only mode. A failed signup does
not consume its code. No invitation emails are sent automatically.

Run the integration regression check against a **dedicated disposable database**:

```bash
TEST_DATABASE_URL=postgresql://.../shootit_registration_test npm run test:registration
```

The check refuses the regular `DATABASE_URL`, creates synthetic users, and clears
only its isolated test schema when done.

## Capture dates for existing selection images

The additive migration in 1.27.0 introduces an optional `capturedAt` column;
existing images, ratings, folders and project data are preserved. Docker updates
apply it through the existing startup migration workflow. In a local checkout,
apply pending migrations and regenerate the client before starting the app:

```sh
npm run db:deploy
npm run db:generate
```

To populate dates for previously uploaded images, run the following once on the
server with access to the original files in `uploads`:

```sh
node --env-file=.env scripts/backfill-selection-dates.cjs
# Docker Compose (environment variables are already injected):
docker compose exec app node scripts/backfill-selection-dates.cjs
```

The script only fills missing capture dates and can be rerun. It reports updated,
missing-date and failed-file counts, and exits with a failure status if any file
could not be processed. It does not modify originals. Images without EXIF
`DateTimeOriginal` stay at the end of capture-date sorting in either direction.
`OffsetTimeOriginal` is respected when present; without a camera timezone, the
wall-clock time is stored as UTC so server timezone changes do not affect sorting.
