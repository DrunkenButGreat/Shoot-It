# PhotoShoot Organizer

A comprehensive self-hosted web application for managing photoshoot projects, built with Next.js 15, TypeScript, and PostgreSQL.

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-15.1-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-6.2-2D3748)](https://www.prisma.io/)

## 🎯 Overview

PhotoShoot Organizer is a production-ready platform designed specifically for photographers and creative teams to manage all aspects of photoshoots, from initial planning to final delivery.

**Implementation Status:** 10 of 12 phases complete (83%) - See [PROGRESS.md](PROGRESS.md) for details.

## ✨ Features

### ✅ Implemented (83%)

- **Authentication & Authorization**
  - Local email/password login with bcrypt
  - Google OAuth integration
  - JWT session management
  - Role-based access control (Owner/Editor/Viewer)

- **Project Management**
  - Create, read, update, and delete projects
  - Dashboard with project grid view
  - Public short URLs for sharing
  - Search and filter capabilities
  - Project statistics and counts

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
  - Responsive grid layout
  - Quick rating updates

- **Contracts Module** (API Complete)
  - Create and manage contracts
  - Digital signature pad with canvas
  - Multiple signatures per contract
  - Signature tracking (IP, timestamp, user agent)
  - PDF export ready

- **Callsheet Module** (API Complete)
  - Shooting schedule management
  - Location details and parking info
  - Emergency contacts
  - Equipment list
  - Timeline visualization ready

- **Results Module** (API Complete)
  - Folder hierarchy for organizing final images
  - Folder creation and management
  - Image upload to folders
  - Download capabilities

### 🚧 In Progress (17%)

- **Image Upload Functionality**
  - Moodboard image uploads
  - Selection gallery imports
  - Results folder uploads

- **Testing & Polish**
  - Dark mode implementation
  - Performance optimization
  - Comprehensive error handling

## 🏗️ Architecture

### Technology Stack

- **Frontend:**
  - Next.js 15.1 (App Router)
  - React 19
  - TypeScript 5.7
  - Tailwind CSS 3.4
  - shadcn/ui components

- **Backend:**
  - Next.js API Routes
  - Prisma 6.2 ORM
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
├── config/                  # Configuration files
│   ├── app.config.ts        # App settings and limits
│   ├── theme.config.ts      # Branding and colors
│   └── export.config.ts     # Export settings
├── prisma/
│   └── schema.prisma        # Database schema (17 models)
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── api/             # API routes (20+ endpoints)
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

### Manual or automatic updates on a Linux host (1.12.0+)

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

Docker Compose installations can opt into automatic stable-release updates with
backups, ordered migrations, readiness checks and compatible image rollback.
See **[setup, existing-installation transition and recovery](deploy/UPDATES.md)**.
From 1.16.0 the app handles the supported legacy schema transition at startup.
PostgreSQL storage migration is separate: preserve the existing DB container and
mounts. The updater is not enabled by default.

From version 1.13.0, manage it on the Linux host with:

```sh
sudo python3 scripts/autoupdate.py check    # Check requirements and paths without changes
sudo python3 scripts/autoupdate.py enable   # Check, install and enable the timer
sudo python3 scripts/autoupdate.py disable  # Disable future runs; let an active update finish
```

Use `--project-dir /opt/shoot-it` and `--backup-dir /mnt/backups/shoot-it` for explicit
paths on first setup. Existing configuration is preserved.

### Initial Setup

1. Navigate to http://localhost:3000
2. Click "Sign Up" to create your first user account
3. Start creating projects!

## 📊 Database Schema

The application uses 17 Prisma models:

- **Authentication:** User, Account, Session, VerificationToken
- **Projects:** Project, ProjectAccess
- **Moodboard:** MoodboardGroup, MoodboardImage, Comment
- **Participants:** Participant, ParticipantImage, ParticipantField
- **Contracts:** Contract, ContractSignature
- **Callsheet:** Callsheet, CallsheetScheduleItem
- **Selection:** SelectionImage, ImageRating
- **Results:** ResultFolder, ResultImage

## 🔌 API Endpoints

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

### Contracts API (5 endpoints)
```
GET    /api/projects/[id]/contracts                  # List contracts
POST   /api/projects/[id]/contracts                  # Create contract
GET    /api/projects/[id]/contracts/[contractId]     # Get contract
PUT    /api/projects/[id]/contracts/[contractId]     # Update contract
DELETE /api/projects/[id]/contracts/[contractId]     # Delete contract
POST   /api/projects/[id]/contracts/[contractId]/sign  # Sign contract
```

### Callsheet API (2 endpoints)
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

**Total:** 26 RESTful API endpoints

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
npm run db:push      # Push schema changes
npm run db:migrate   # Run migrations
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

## Administration (1.11.0)

The admin dashboard is available at `/admin`, with a link on the project dashboard
for administrators. It includes user/project counts, the latest 20 users, registration
settings and the latest 50 invitation codes. Existing user accounts retain login access
in all modes. No existing or newly registered account automatically becomes an admin.

### Upgrade without data loss

Back up the database first. Up to version 1.11.0 this repository used `prisma db push` (also at
Docker startup), rather than a migration history. Starting with 1.12.0, follow
[the migration-baseline transition](deploy/UPDATES.md) instead. Version 1.11.0 only adds tables and
the `User.isAdmin` column. Either use the existing `db push` workflow or apply the
repeatable SQL upgrade **before starting the new application**:

```bash
npx prisma db execute --file prisma/upgrades/1.11.0.sql --schema prisma/schema.prisma
npm run db:generate
```

Grant access to a specific existing account from the trusted server environment:

```bash
npm run admin:grant -- admin@example.com
# Revoke access immediately (also affects existing sessions):
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
