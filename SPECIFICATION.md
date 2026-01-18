# PhotoShoot Organizer - Technische Spezifikation v2.0

## Projektübersicht

**Projektname:** PhotoShoot Organizer  
**Version:** 2.0.0  
**Stand:** Januar 2025  
**Typ:** Self-Hosted Web Application  
**Zweck:** Umfassendes Tool zur Organisation und Verwaltung von Fotoshootings

---

## 1. Technische Architektur

### 1.1 Tech Stack

| Komponente | Technologie | Version |
|------------|-------------|---------|
| Runtime | Node.js | 24.x LTS |
| Frontend | Next.js (App Router) | 16.1.x |
| Sprache | TypeScript | 5.9.x |
| Styling | Tailwind CSS | 4.x |
| UI Components | shadcn/ui | latest |
| Backend/API | Next.js API Routes + Server Actions | 16.1.x |
| ORM | Prisma | 7.x |
| Datenbank | PostgreSQL | 18.x |
| Authentifizierung | Auth.js (NextAuth v5) | 5.x |
| File Storage | Local Volume (Docker) | - |
| Containerisierung | Docker & Docker Compose | latest |

### 1.2 Externe Abhängigkeiten

**Vollständig lokal deploybar!** Keine Cloud-Dienste erforderlich.

| Dienst | Status | Anmerkung |
|--------|--------|-----------|
| Datenbank | ✅ Lokal | PostgreSQL im Container |
| Datei-Speicher | ✅ Lokal | Docker Volumes |
| Image-Verarbeitung | ✅ Lokal | Sharp (Node.js) |
| PDF-Generierung | ✅ Lokal | @react-pdf/renderer |
| Auth | ⚠️ Optional extern | Google OAuth optional, lokaler Login möglich |
| E-Mail | ⚠️ Optional extern | SMTP für Benachrichtigungen (optional) |

### 1.3 Systemarchitektur

```
┌─────────────────────────────────────────────────────────────────┐
│                        Docker Network                           │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────┐      ┌─────────────────────┐          │
│  │   App Container     │      │   DB Container      │          │
│  │   (Next.js 16)      │◄────►│   (PostgreSQL 18)   │          │
│  │   Node.js 24 LTS    │      │   Port: 5432        │          │
│  │   Port: 3000        │      │                     │          │
│  └─────────────────────┘      └─────────────────────┘          │
│           │                            │                        │
│           ▼                            ▼                        │
│  ┌─────────────────────┐      ┌─────────────────────┐          │
│  │   Volume: uploads   │      │   Volume: db_data   │          │
│  │   /app/uploads      │      │   /var/lib/postgres │          │
│  └─────────────────────┘      └─────────────────────┘          │
│           │                                                     │
│           ▼                                                     │
│  ┌─────────────────────┐                                       │
│  │  Volume: local_media│  (Server-lokaler Ordner für Import)   │
│  │  /app/local_media   │                                       │
│  └─────────────────────┘                                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Datenmodell (Prisma Schema)

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ==================== AUTHENTICATION ====================

model User {
  id            String    @id @default(cuid())
  email         String    @unique
  name          String?
  image         String?
  password      String?   // Für lokalen Login (bcrypt hash)
  emailVerified DateTime?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  // Auth Relations
  accounts      Account[]
  sessions      Session[]
  
  // App Relations
  ownedProjects     Project[]        @relation("ProjectOwner")
  projectAccess     ProjectAccess[]
  participantLinks  Participant[]    @relation("UserParticipant")
  comments          Comment[]
  signatures        ContractSignature[]
  imageRatings      ImageRating[]
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}

// ==================== PROJECTS ====================

model Project {
  id          String   @id @default(cuid())
  name        String
  description String?  @db.Text
  date        DateTime
  location    String
  address     String?
  shortCode   String   @unique  // Für öffentliche Kurz-URLs
  isPublic    Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // Owner
  ownerId     String
  owner       User     @relation("ProjectOwner", fields: [ownerId], references: [id])

  // Relations
  access          ProjectAccess[]
  moodboardGroups MoodboardGroup[]
  participants    Participant[]
  contracts       Contract[]
  callsheet       Callsheet?
  selectionImages SelectionImage[]
  resultFolders   ResultFolder[]

  @@index([shortCode])
  @@index([ownerId])
}

model ProjectAccess {
  id        String      @id @default(cuid())
  projectId String
  userId    String
  role      ProjectRole @default(VIEWER)
  createdAt DateTime    @default(now())

  project   Project     @relation(fields: [projectId], references: [id], onDelete: Cascade)
  user      User        @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([projectId, userId])
}

enum ProjectRole {
  OWNER
  EDITOR
  VIEWER
}

// ==================== MOODBOARD ====================

model MoodboardGroup {
  id          String          @id @default(cuid())
  name        String
  description String?         @db.Text
  order       Int             @default(0)
  status      MoodboardStatus @default(PENDING)
  projectId   String
  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt

  project     Project         @relation(fields: [projectId], references: [id], onDelete: Cascade)
  images      MoodboardImage[]
  comments    Comment[]

  @@index([projectId])
}

enum MoodboardStatus {
  PENDING
  ACCEPTED
  REJECTED
}

model MoodboardImage {
  id        String   @id @default(cuid())
  filename  String
  path      String
  thumbnail String?
  width     Int?
  height    Int?
  size      Int?
  order     Int      @default(0)
  groupId   String
  createdAt DateTime @default(now())

  group     MoodboardGroup @relation(fields: [groupId], references: [id], onDelete: Cascade)

  @@index([groupId])
}

model Comment {
  id        String   @id @default(cuid())
  content   String   @db.Text
  groupId   String
  userId    String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  group     MoodboardGroup @relation(fields: [groupId], references: [id], onDelete: Cascade)
  user      User           @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([groupId])
}

// ==================== PARTICIPANTS ====================

model Participant {
  id          String   @id @default(cuid())
  name        String
  email       String?
  phone       String?
  role        String?  // z.B. "Model", "MUA", "Stylist", "Fotograf"
  notes       String?  @db.Text
  projectId   String
  userId      String?  // Verknüpfung mit User-Account falls vorhanden
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  user        User?    @relation("UserParticipant", fields: [userId], references: [id])
  images      ParticipantImage[]
  customFields ParticipantField[]

  @@index([projectId])
  @@index([userId])
  @@index([email])
}

model ParticipantImage {
  id            String   @id @default(cuid())
  filename      String
  path          String
  thumbnail     String?
  participantId String
  createdAt     DateTime @default(now())

  participant   Participant @relation(fields: [participantId], references: [id], onDelete: Cascade)

  @@index([participantId])
}

model ParticipantField {
  id            String @id @default(cuid())
  key           String
  value         String
  participantId String

  participant   Participant @relation(fields: [participantId], references: [id], onDelete: Cascade)

  @@unique([participantId, key])
}

// ==================== CONTRACTS ====================

model Contract {
  id          String   @id @default(cuid())
  title       String
  content     String   @db.Text  // Markdown
  projectId   String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  signatures  ContractSignature[]

  @@index([projectId])
}

model ContractSignature {
  id          String   @id @default(cuid())
  contractId  String
  userId      String?
  name        String   // Name des Unterzeichners
  email       String
  signature   String   @db.Text  // Base64 encoded signature image
  ipAddress   String?
  userAgent   String?
  signedAt    DateTime @default(now())

  contract    Contract @relation(fields: [contractId], references: [id], onDelete: Cascade)
  user        User?    @relation(fields: [userId], references: [id])

  @@index([contractId])
}

// ==================== CALLSHEET ====================

model Callsheet {
  id              String   @id @default(cuid())
  projectId       String   @unique
  
  // Zeitplan
  callTime        DateTime?
  startTime       DateTime?
  endTime         DateTime?
  wrapTime        DateTime?
  
  // Location Details
  locationName    String?
  locationAddress String?
  locationNotes   String?  @db.Text
  parkingInfo     String?  @db.Text
  
  // Kontakte
  emergencyContact String?
  emergencyPhone   String?
  
  // Zusätzliche Infos
  weatherInfo     String?
  dresscode       String?
  equipmentList   String?  @db.Text
  additionalNotes String?  @db.Text
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  project         Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  scheduleItems   CallsheetScheduleItem[]
}

model CallsheetScheduleItem {
  id          String    @id @default(cuid())
  callsheetId String
  time        DateTime
  duration    Int?      // Minuten
  activity    String
  notes       String?
  order       Int       @default(0)

  callsheet   Callsheet @relation(fields: [callsheetId], references: [id], onDelete: Cascade)

  @@index([callsheetId])
}

// ==================== SELECTION GALLERY ====================

model SelectionImage {
  id          String   @id @default(cuid())
  filename    String
  path        String
  thumbnail   String?
  width       Int?
  height      Int?
  size        Int?
  projectId   String
  importedAt  DateTime @default(now())

  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  ratings     ImageRating[]

  @@index([projectId])
  @@index([filename])
}

model ImageRating {
  id        String       @id @default(cuid())
  imageId   String
  oderId    String
  stars     Int?         @db.SmallInt  // 1-5
  color     RatingColor?
  createdAt DateTime     @default(now())
  updatedAt DateTime     @updatedAt

  image     SelectionImage @relation(fields: [imageId], references: [id], onDelete: Cascade)
  user      User           @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([imageId, userId])
  @@map("image_rating")
}

enum RatingColor {
  RED
  YELLOW
  GREEN
}

// ==================== RESULTS ====================

model ResultFolder {
  id          String   @id @default(cuid())
  name        String
  path        String
  parentId    String?
  projectId   String
  createdAt   DateTime @default(now())

  project     Project       @relation(fields: [projectId], references: [id], onDelete: Cascade)
  parent      ResultFolder? @relation("FolderHierarchy", fields: [parentId], references: [id])
  children    ResultFolder[] @relation("FolderHierarchy")
  images      ResultImage[]

  @@index([projectId])
  @@index([parentId])
}

model ResultImage {
  id          String   @id @default(cuid())
  filename    String
  path        String
  thumbnail   String?
  width       Int?
  height      Int?
  size        Int?
  folderId    String?
  createdAt   DateTime @default(now())

  folder      ResultFolder? @relation(fields: [folderId], references: [id], onDelete: SetNull)

  @@index([folderId])
}
```

---

## 3. Projektstruktur

```
photoshoot-organizer/
├── docker-compose.yml
├── Dockerfile
├── .env.example
├── .env.local              # Lokale Entwicklung (nicht committen)
├── .gitignore
├── README.md
├── DOCUMENTATION.md
│
├── config/
│   ├── app.config.ts       # Zentrale App-Konfiguration
│   ├── theme.config.ts     # Farben, Logos, Branding
│   └── export.config.ts    # Export-Einstellungen
│
├── prisma/
│   ├── schema.prisma
│   └── migrations/
│
├── public/
│   ├── logo.svg
│   ├── favicon.ico
│   └── images/
│
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                    # Landing/Login
│   │   ├── globals.css                 # Tailwind v4 CSS
│   │   │
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   └── api/
│   │   │       └── auth/
│   │   │           └── [...nextauth]/
│   │   │               └── route.ts
│   │   │
│   │   ├── (protected)/                # Geschützte Routen
│   │   │   ├── layout.tsx              # Auth-Check Wrapper
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx            # Projektübersicht
│   │   │   │
│   │   │   └── project/
│   │   │       └── [id]/
│   │   │           ├── page.tsx        # Projekt-Dashboard
│   │   │           ├── layout.tsx
│   │   │           ├── moodboard/
│   │   │           │   └── page.tsx
│   │   │           ├── participants/
│   │   │           │   └── page.tsx
│   │   │           ├── contracts/
│   │   │           │   ├── page.tsx
│   │   │           │   └── [contractId]/
│   │   │           │       └── page.tsx
│   │   │           ├── callsheet/
│   │   │           │   └── page.tsx
│   │   │           ├── selection/
│   │   │           │   └── page.tsx
│   │   │           └── results/
│   │   │               └── page.tsx
│   │   │
│   │   ├── p/                          # Öffentliche Kurz-URLs
│   │   │   └── [shortCode]/
│   │   │       └── page.tsx
│   │   │
│   │   └── api/
│   │       ├── health/
│   │       │   └── route.ts            # Health Check Endpoint
│   │       ├── projects/
│   │       │   ├── route.ts            # GET (list), POST (create)
│   │       │   └── [id]/
│   │       │       ├── route.ts        # GET, PUT, DELETE
│   │       │       ├── moodboard/
│   │       │       │   └── route.ts
│   │       │       ├── participants/
│   │       │       │   └── route.ts
│   │       │       ├── contracts/
│   │       │       │   └── route.ts
│   │       │       ├── callsheet/
│   │       │       │   └── route.ts
│   │       │       ├── selection/
│   │       │       │   └── route.ts
│   │       │       └── results/
│   │       │           └── route.ts
│   │       │
│   │       ├── upload/
│   │       │   └── route.ts
│   │       │
│   │       ├── import/
│   │       │   └── local/
│   │       │       └── route.ts        # Import von lokalem Ordner
│   │       │
│   │       └── export/
│   │           ├── selection/
│   │           │   └── route.ts
│   │           ├── callsheet/
│   │           │   └── route.ts
│   │           └── contract/
│   │               └── route.ts
│   │
│   ├── auth.ts                         # Auth.js v5 Konfiguration
│   │
│   ├── components/
│   │   ├── ui/                         # shadcn/ui Komponenten
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── dropdown-menu.tsx
│   │   │   ├── input.tsx
│   │   │   ├── label.tsx
│   │   │   ├── select.tsx
│   │   │   ├── textarea.tsx
│   │   │   ├── toast.tsx
│   │   │   └── ...
│   │   │
│   │   ├── layout/
│   │   │   ├── Header.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Footer.tsx
│   │   │   └── Navigation.tsx
│   │   │
│   │   ├── auth/
│   │   │   ├── LoginForm.tsx
│   │   │   ├── UserMenu.tsx
│   │   │   └── AuthProvider.tsx
│   │   │
│   │   ├── projects/
│   │   │   ├── ProjectCard.tsx
│   │   │   ├── ProjectList.tsx
│   │   │   ├── ProjectForm.tsx
│   │   │   └── ProjectNav.tsx
│   │   │
│   │   ├── moodboard/
│   │   │   ├── MoodboardGrid.tsx       # Masonry Layout
│   │   │   ├── MoodboardGroup.tsx
│   │   │   ├── GroupComments.tsx
│   │   │   ├── GroupStatusBadge.tsx
│   │   │   └── ImageUploader.tsx
│   │   │
│   │   ├── participants/
│   │   │   ├── ParticipantList.tsx
│   │   │   ├── ParticipantCard.tsx
│   │   │   ├── ParticipantForm.tsx
│   │   │   └── ParticipantGallery.tsx
│   │   │
│   │   ├── contracts/
│   │   │   ├── ContractEditor.tsx      # Markdown Editor
│   │   │   ├── ContractPreview.tsx
│   │   │   ├── SignaturePad.tsx
│   │   │   ├── ContractPDF.tsx
│   │   │   └── SignatureList.tsx
│   │   │
│   │   ├── callsheet/
│   │   │   ├── CallsheetEditor.tsx
│   │   │   ├── CallsheetPreview.tsx
│   │   │   ├── ScheduleTimeline.tsx
│   │   │   └── CallsheetPDF.tsx
│   │   │
│   │   ├── selection/
│   │   │   ├── SelectionGallery.tsx
│   │   │   ├── ImageCard.tsx
│   │   │   ├── RatingStars.tsx
│   │   │   ├── ColorLabel.tsx
│   │   │   ├── FilterBar.tsx
│   │   │   ├── LocalFolderImport.tsx
│   │   │   └── ExportDialog.tsx
│   │   │
│   │   ├── results/
│   │   │   ├── ResultsGallery.tsx
│   │   │   ├── FolderTree.tsx
│   │   │   ├── BulkDownload.tsx
│   │   │   └── LocalFolderImport.tsx
│   │   │
│   │   └── shared/
│   │       ├── ImageLightbox.tsx
│   │       ├── ConfirmDialog.tsx
│   │       ├── LoadingSpinner.tsx
│   │       ├── EmptyState.tsx
│   │       ├── ErrorBoundary.tsx
│   │       └── DragDropZone.tsx
│   │
│   ├── lib/
│   │   ├── prisma.ts                   # Prisma Client
│   │   ├── utils.ts                    # Utility Functions
│   │   ├── validations.ts              # Zod Schemas
│   │   ├── permissions.ts              # Berechtigungsprüfung
│   │   ├── shortcode.ts                # Kurz-URL Generator
│   │   ├── image-processing.ts         # Thumbnail-Generierung
│   │   ├── pdf-generator.ts            # PDF Export
│   │   └── file-utils.ts               # Dateioperationen
│   │
│   ├── hooks/
│   │   ├── useProject.ts
│   │   ├── useUpload.ts
│   │   ├── useImageRating.ts
│   │   ├── useLocalFolder.ts
│   │   └── useExport.ts
│   │
│   ├── types/
│   │   ├── index.ts
│   │   ├── project.ts
│   │   ├── moodboard.ts
│   │   ├── participant.ts
│   │   ├── contract.ts
│   │   ├── callsheet.ts
│   │   ├── selection.ts
│   │   └── results.ts
│   │
│   └── proxy.ts                        # Auth Middleware
│
├── uploads/                            # Hochgeladene Dateien (Volume)
│   └── .gitkeep
│
└── local_media/                        # Lokaler Import-Ordner (Read-Only)
    └── .gitkeep
```

---

## 4. API Spezifikation

### 4.1 Health Check

```typescript
// GET /api/health
// Response: { status: "ok", timestamp: "2025-01-04T..." }
```

### 4.2 Projects API

```typescript
// GET /api/projects
// Query: ?search=string&page=number&limit=number
// Response: { projects: Project[], total: number, page: number }

// POST /api/projects
// Body: { name: string, date: string, location: string, description?: string }
// Response: Project

// GET /api/projects/[id]
// Response: Project (mit Relations)

// PUT /api/projects/[id]
// Body: Partial<Project>
// Response: Project

// DELETE /api/projects/[id]
// Response: { success: true }
```

### 4.3 Moodboard API

```typescript
// GET /api/projects/[id]/moodboard
// Response: { groups: MoodboardGroup[] }

// POST /api/projects/[id]/moodboard/groups
// Body: { name: string, description?: string }
// Response: MoodboardGroup

// PUT /api/projects/[id]/moodboard/groups/[groupId]
// Body: { name?: string, status?: MoodboardStatus, order?: number }
// Response: MoodboardGroup

// DELETE /api/projects/[id]/moodboard/groups/[groupId]
// Response: { success: true }

// POST /api/projects/[id]/moodboard/groups/[groupId]/images
// Body: FormData (files)
// Response: { images: MoodboardImage[] }

// POST /api/projects/[id]/moodboard/groups/[groupId]/comments
// Body: { content: string }
// Response: Comment
```

### 4.4 Participants API

```typescript
// GET /api/projects/[id]/participants
// Response: { participants: Participant[] }

// POST /api/projects/[id]/participants
// Body: { name: string, email?: string, role?: string, notes?: string }
// Response: Participant

// PUT /api/projects/[id]/participants/[participantId]
// Body: Partial<Participant>
// Response: Participant

// DELETE /api/projects/[id]/participants/[participantId]
// Response: { success: true }

// POST /api/projects/[id]/participants/[participantId]/images
// Body: FormData (files)
// Response: { images: ParticipantImage[] }
```

### 4.5 Contracts API

```typescript
// GET /api/projects/[id]/contracts
// Response: { contracts: Contract[] }

// POST /api/projects/[id]/contracts
// Body: { title: string, content: string }
// Response: Contract

// GET /api/projects/[id]/contracts/[contractId]
// Response: Contract (mit Signatures)

// PUT /api/projects/[id]/contracts/[contractId]
// Body: { title?: string, content?: string }
// Response: Contract

// POST /api/projects/[id]/contracts/[contractId]/sign
// Body: { signature: string, name: string, email: string }
// Response: ContractSignature

// GET /api/export/contract/[contractId]/pdf
// Response: PDF File
```

### 4.6 Callsheet API

```typescript
// GET /api/projects/[id]/callsheet
// Response: Callsheet

// PUT /api/projects/[id]/callsheet
// Body: Partial<Callsheet>
// Response: Callsheet

// POST /api/projects/[id]/callsheet/schedule
// Body: { time: string, activity: string, duration?: number, notes?: string }
// Response: CallsheetScheduleItem

// GET /api/export/callsheet/[id]/pdf
// Response: PDF File
```

### 4.7 Selection Gallery API

```typescript
// GET /api/projects/[id]/selection
// Query: ?stars=1-5&color=RED|YELLOW|GREEN&page=number
// Response: { images: SelectionImage[], total: number }

// POST /api/projects/[id]/selection/upload
// Body: FormData (files)
// Response: { images: SelectionImage[] }

// POST /api/projects/[id]/selection/import
// Body: { path: string }
// Response: { imported: number, images: SelectionImage[] }

// PUT /api/projects/[id]/selection/[imageId]/rating
// Body: { stars?: number, color?: RatingColor }
// Response: ImageRating

// GET /api/export/selection/[id]
// Query: ?separator=string&stars=number&color=string&format=txt|csv|json
// Response: Text/CSV/JSON File
```

### 4.8 Results API

```typescript
// GET /api/projects/[id]/results
// Response: { folders: ResultFolder[], rootImages: ResultImage[] }

// POST /api/projects/[id]/results/folders
// Body: { name: string, parentId?: string }
// Response: ResultFolder

// POST /api/projects/[id]/results/upload
// Body: FormData (files, folderId?)
// Response: { images: ResultImage[] }

// POST /api/projects/[id]/results/import
// Body: { path: string, preserveStructure?: boolean }
// Response: { imported: number }

// GET /api/projects/[id]/results/download
// Query: ?folderId=string (optional)
// Response: ZIP File

// GET /api/projects/[id]/results/[imageId]/download
// Response: Image File
```

---

## 5. Sicherheitsanforderungen

### 5.1 Input Validation (Zod Schemas)

```typescript
// src/lib/validations.ts

import { z } from 'zod'

export const projectSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(5000).optional(),
  date: z.string().datetime(),
  location: z.string().min(1).max(200),
  address: z.string().max(500).optional(),
})

export const participantSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(50).optional(),
  role: z.string().max(50).optional(),
  notes: z.string().max(5000).optional(),
})

export const contractSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(50000),
})

export const signatureSchema = z.object({
  signature: z.string().min(1), // Base64
  name: z.string().min(1).max(100),
  email: z.string().email(),
})

export const ratingSchema = z.object({
  stars: z.number().min(1).max(5).optional(),
  color: z.enum(['RED', 'YELLOW', 'GREEN']).optional(),
})

export const callsheetSchema = z.object({
  callTime: z.string().datetime().optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  wrapTime: z.string().datetime().optional(),
  locationName: z.string().max(200).optional(),
  locationAddress: z.string().max(500).optional(),
  locationNotes: z.string().max(5000).optional(),
  parkingInfo: z.string().max(2000).optional(),
  emergencyContact: z.string().max(100).optional(),
  emergencyPhone: z.string().max(50).optional(),
  weatherInfo: z.string().max(500).optional(),
  dresscode: z.string().max(500).optional(),
  equipmentList: z.string().max(5000).optional(),
  additionalNotes: z.string().max(5000).optional(),
})
```

### 5.2 File Upload Security

```typescript
// src/lib/file-utils.ts

import { appConfig } from '@/config/app.config'
import path from 'path'
import crypto from 'crypto'

export function validateUpload(file: File): { valid: boolean; error?: string } {
  // Größenprüfung
  if (file.size > appConfig.limits.maxUploadSize) {
    return { valid: false, error: `Datei zu groß (max. ${appConfig.limits.maxUploadSize / 1024 / 1024}MB)` }
  }
  
  // Typ-Prüfung
  const ext = path.extname(file.name).toLowerCase().slice(1)
  if (!appConfig.imageProcessing.supportedFormats.includes(ext)) {
    return { valid: false, error: `Format nicht unterstützt: ${ext}` }
  }
  
  // MIME-Type Prüfung
  const allowedMimes = [
    'image/jpeg', 'image/png', 'image/webp', 
    'image/gif', 'image/tiff', 'image/heic'
  ]
  if (!allowedMimes.includes(file.type)) {
    return { valid: false, error: 'Ungültiger Dateityp' }
  }
  
  return { valid: true }
}

export function generateSecureFilename(originalName: string): string {
  const ext = path.extname(originalName).toLowerCase()
  const hash = crypto.randomBytes(16).toString('hex')
  const timestamp = Date.now()
  return `${timestamp}-${hash}${ext}`
}

// Path Traversal Prevention
export function sanitizePath(inputPath: string, basePath: string): string | null {
  const resolved = path.resolve(basePath, inputPath)
  if (!resolved.startsWith(path.resolve(basePath))) {
    return null // Path traversal attempt
  }
  return resolved
}

export function isPathSafe(inputPath: string): boolean {
  // Verhindere Path Traversal
  const dangerous = ['..', '~', '$', '|', ';', '&', '>', '<', '`']
  return !dangerous.some(char => inputPath.includes(char))
}
```

---

## 6. UI/UX Anforderungen

### 6.1 Responsive Design Breakpoints

```css
/* Tailwind v4 Breakpoints (Standard) */
/* sm: 640px, md: 768px, lg: 1024px, xl: 1280px, 2xl: 1536px */
```

### 6.2 Kernseiten-Layouts

#### Dashboard (Projektübersicht)

```
┌─────────────────────────────────────────────────────────────┐
│  [Logo]  PhotoShoot Organizer           [User Menu ▼]       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Meine Projekte                        [+ Neues Projekt]    │
│                                                             │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │  Projekt 1  │ │  Projekt 2  │ │  Projekt 3  │           │
│  │  📅 15.03.  │ │  📅 22.03.  │ │  📅 01.04.  │           │
│  │  📍 Berlin  │ │  📍 Hamburg │ │  📍 München │           │
│  │  [Details]  │ │  [Details]  │ │  [Details]  │           │
│  └─────────────┘ └─────────────┘ └─────────────┘           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### Projekt-Ansicht

```
┌─────────────────────────────────────────────────────────────┐
│  [← Zurück]  Projektname                [Teilen] [⚙️]       │
├──────────────┬──────────────────────────────────────────────┤
│              │                                              │
│  📋 Übersicht│                                              │
│  🎨 Moodboard│           [Aktiver Bereich]                  │
│  👥 Teilnehm.│                                              │
│  📝 Verträge │                                              │
│  📞 Callsheet│                                              │
│  ⭐ Auswahl  │                                              │
│  🖼️ Ergebnisse│                                              │
│              │                                              │
└──────────────┴──────────────────────────────────────────────┘
```

---

## 7. Komponenten-Spezifikationen

### 7.1 Moodboard Masonry Gallery

```typescript
interface MoodboardGridProps {
  groups: MoodboardGroup[]
  onGroupStatusChange: (groupId: string, status: MoodboardStatus) => void
  onAddComment: (groupId: string, comment: string) => void
  onUploadImages: (groupId: string, files: File[]) => void
  onCreateGroup: (name: string) => void
  onDeleteGroup: (groupId: string) => void
  editable: boolean
}

// Features:
// - Masonry Layout (CSS Grid oder react-masonry-css)
// - Drag & Drop für Bildupload
// - Lightbox für Bildvorschau
// - Inline-Kommentare pro Gruppe
// - Status-Toggle (✓ Akzeptiert / ✗ Abgelehnt)
// - Sortierung per Drag & Drop
```

### 7.2 Selection Gallery

```typescript
interface SelectionGalleryProps {
  images: SelectionImage[]
  onRatingChange: (imageId: string, rating: { stars?: number; color?: RatingColor }) => void
  onExport: (options: ExportOptions) => void
  onImportLocal: (path: string) => void
}

interface ExportOptions {
  separator: string
  filterStars?: number
  filterColor?: RatingColor
  includeExtension: boolean
  format: 'txt' | 'csv' | 'json'
}

// Features:
// - Grid-Ansicht mit variabler Größe
// - Sterne-Bewertung (1-5) per Hover/Click
// - Farb-Label (Rot/Gelb/Grün) per Click
// - Filter-Sidebar
// - Multi-Select für Batch-Operationen
// - Export-Dialog mit Konfiguration
// - Import von lokalem Server-Ordner
```

### 7.3 Contract Signature

```typescript
interface SignaturePadProps {
  onSign: (signature: string, name: string, email: string) => void
  contractId: string
}

// Features:
// - Canvas-basiertes Unterschriftenfeld
// - Touch-Support
// - Clear/Undo Funktionen
// - Name & E-Mail Eingabe
// - Bestätigung vor Absenden
// - Timestamp & IP-Logging
```

### 7.4 Callsheet PDF Export

```typescript
interface CallsheetPDFProps {
  callsheet: Callsheet
  project: Project
  participants: Participant[]
}

// Features:
// - Professionelles PDF-Layout
// - Projekt-Header mit Logo
// - Zeitplan als Tabelle
// - Teilnehmer-Liste mit Kontaktdaten
// - Location-Informationen
// - Druck-optimiertes Layout
```

---

## 8. Implementierungs-Checkliste

### Phase 1: Grundgerüst
- [ ] Next.js 16 Projekt Setup mit TypeScript
- [ ] Docker Compose Konfiguration
- [ ] Prisma Schema & initiale Migration
- [ ] Auth.js v5 Integration (Google + Credentials)
- [ ] Basis-Layout & Navigation
- [ ] Health Check Endpoint

### Phase 2: Projektverwaltung
- [ ] Projektliste (Dashboard)
- [ ] Projekt erstellen/bearbeiten/löschen
- [ ] Öffentliche Kurz-URLs generieren
- [ ] Berechtigungssystem (Owner/Editor/Viewer)

### Phase 3: Moodboard
- [ ] Gruppen-Management (CRUD)
- [ ] Masonry Gallery Komponente
- [ ] Bild-Upload mit Thumbnail-Generierung
- [ ] Kommentar-System
- [ ] Status-Markierungen (Akzeptiert/Abgelehnt)

### Phase 4: Teilnehmer
- [ ] Teilnehmer-CRUD
- [ ] Bild-Upload pro Teilnehmer
- [ ] Custom Fields
- [ ] User-Account Verknüpfung

### Phase 5: Verträge
- [ ] Markdown-Editor
- [ ] Vertragsvorschau (Markdown → HTML)
- [ ] Signature Pad Integration
- [ ] PDF-Export mit Unterschriften

### Phase 6: Callsheet
- [ ] Datenerfassung-Formular
- [ ] Zeitplan-Management
- [ ] PDF-Export/Druck

### Phase 7: Auswahl-Galerie
- [ ] Bild-Upload
- [ ] Import von lokalem Server-Ordner
- [ ] Stern-Bewertung (1-5)
- [ ] Farb-Markierungen (Rot/Gelb/Grün)
- [ ] Filter-Funktionalität
- [ ] Export (Dateinamen-Liste)

### Phase 8: Ergebnisse
- [ ] Ordnerstruktur-Management
- [ ] Bild-Upload
- [ ] Import von lokalem Server-Ordner
- [ ] Einzeldownload
- [ ] Bulk-Download (ZIP)

### Phase 9: Feinschliff
- [ ] Responsive Design testen
- [ ] Dark Mode
- [ ] Performance-Optimierung
- [ ] Error Handling & Loading States
- [ ] Dokumentation vervollständigen

---

## Anhang: Wichtige Hinweise für den Coding Agent

### Next.js 16 Besonderheiten
- Turbopack ist Standard-Bundler
- `next.config.ts` statt `.js`
- Server Actions sind stable
- React 19.2 Features verfügbar

### Tailwind CSS v4 Besonderheiten
- CSS-First Configuration mit `@theme`
- Kein `tailwind.config.js` nötig
- Automatische Content-Detection
- Native CSS Layers

### Prisma 7 Besonderheiten
- Rust-Free Engine (WASM-basiert)
- Neues Config-Format möglich
- Deutlich schnellere Queries

### Auth.js v5 Besonderheiten
- Neues Export-Pattern: `{ handlers, auth, signIn, signOut }`
- Konfiguration in separater `auth.ts`
- Environment Variables mit `AUTH_` Prefix
