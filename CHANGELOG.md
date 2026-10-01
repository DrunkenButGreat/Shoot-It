# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.19.0] - 2026-10-01

### Added
- Project cover editing, accessible header and profile menus, generated photography assets, and a password visibility toggle.
- Offline design checks for German and English, public gallery controls, participant cards, and callsheet timestamp rendering.

### Changed
- Brought project, selection, results, moodboard, participant, contract, callsheet, appointment, application, profile, authentication and public screens closer to the approved designs.
- Reworked image folders, breadcrumbs, grid/list views, detail panels and selection actions; improved desktop spacing and mobile navigation.

### Fixed
- Preserved image IDs when dragging selections between folders and kept public gallery controls read-only.
- Corrected callsheet save fields and schedule timestamps, retained schedule notes, and added visible save errors.
- Fixed mobile filter overflow, drawer focus handling and missing German/English interface text.

## [1.18.2] - 2026-09-30

### Fixed
- Gallery thumbnails load lazily and decode asynchronously; videos no longer preload metadata. Public moodboards use generated thumbnails while the lightbox retains full-resolution media (#22).

### Changed
- Updated Next.js to 16.2.3 and Nodemailer to 8.0.5 (#18, #21).
- Updated Auth.js to 5.0.0-beta.32 for Nodemailer 8 compatibility so clean installs and Docker builds continue to work without peer-dependency bypasses.
- Updated transitive dependencies: minimatch, flatted, picomatch, brace-expansion, defu, lodash, fast-xml-parser and the AWS SES SDK (#9, #12, #14, #16, #17, #19, #20).

## [1.18.1] - 2026-09-30

### Removed
- Retired the separate Linux host/systemd updater, installer, management commands and their dedicated tests. The Docker updater remains the automatic-update path on Linux and QNAP.
- Obsolete manual 1.11/1.12 transition instructions; current guidance uses app-start migration or the Docker updater. Historical migration SQL and recovery support remain available.

### Changed
- Consolidated update documentation and retained shared release validation, safe downloads, journal helpers and manual Compose coverage for the Docker updater. Existing host installations have explicit timer-retirement instructions; saved backups and journals are not removed.

## [1.18.0] - 2026-09-30

### Changed
- Extended the workspace redesign across profile, project, participant, contract, callsheet, selection, results, moodboard, appointment and public views.
- Kept the desktop navigation and content side by side while retaining the single-column mobile layout.

## [1.17.0] - 2026-09-30

### Added
- The first successful registration becomes the instance owner and administrator, including Google OAuth registrations. Concurrent first signups elect exactly one owner.
- Existing installations promote their oldest account through a data-preserving migration. Other admin grants and project ownership remain unchanged.
- Owner label in the admin dashboard and protection against revoking the owner's admin access with the administration command.

## [1.16.0] - 2026-09-30

### Added
- Automatic legacy migration at app startup: the stock 1.8.x–1.11.x schema is backed up in the persistent uploads volume, bridged and baselined before the web server starts. Fresh and already migrated databases apply normal migrations.
- Shared database migration lock, durable interruption marker, bundled PostgreSQL backup tools and blocked HTTP access to migration backups. Container tests cover backup restore, repeated startup, backup failure and schema drift.
- `migrate` command in the updater container: database-only backup and migration, without upload archiving or app image replacement. The old app remains stopped with restart disabled after success.
- Additive bridge for stock 1.8.x/1.9.x schemas before the 1.11 baseline and current migrations; repeated runs preserve users, projects and existing registration settings.
- Migration-only integration coverage, explicit release capability/minimum version, and Container Station instructions. Failed/interrupted migrations remain blocked for recovery.

## [1.15.0] - 2026-09-30

### Added
- Standalone updater image and QNAP Container Station template: detects installed versions, checks actual Docker storage, backs up the database/uploads, and replaces only the application container. No host Python, systemd, Compose CLI, checkout or `.env` path required.
- Explicit, repeatable legacy upgrade from the 1.10 schema through the additive 1.11 changes, validated baseline and current migrations in one maintenance run.
- One-time, check and scheduled modes; persistent recovery journal, daemon-wide update lock, compatible image rollback and blocked retries after interrupted migrations.
- Disposable container integration tests for legacy PostgreSQL 18 mounts, backup restore, preserved container settings, failed migrations and rollback; release CI publishes the updater image only to `latest` after verification.

### Changed
- NAS documentation uses the container workflow; existing manual Compose and opt-in Linux host updater remain available.

## [1.14.0] - 2026-09-30

### Added
- A consistent studio workspace with dark project navigation, compact top bar, responsive mobile drawer and image-led project cards.
- Dedicated public landing, authentication and project showcase layouts in the new Shoot-It visual system.

### Changed
- Redesigned dashboard, project overview, moodboard entry, profile, admin and project modules around the new cobalt, graphite and cool-gray interface.
- Standardized cards, buttons, form fields, spacing, navigation states and German/English interface copy.

## [1.13.0] - 2026-09-30

### Added
- Host management script with read-only requirement/path checks and explicit automatic-update enable/disable commands, including custom project, backup and Compose paths.
- Checks for service prerequisites, migration status, persistent storage, free space, image override support and interrupted/running updates; management regression tests.

### Changed
- Existing installer delegates to the management script. Disabling the timer preserves running migrations, the image pin, configuration and backups.

### Fixed
- Validate Compose image override support before changing `.env`.
- Check backup capacity even before the configured backup directory exists.

## [1.12.0] - 2026-09-30

### Added
- Opt-in Linux/systemd Docker Compose updater with stable GitHub release detection, digest pinning, a configurable maintenance window, persistent transaction state and exclusive locking.
- Consistent database/uploads backups, storage/space checks, compatible image rollback, failed-release blocking and manual recovery instructions.
- Versioned Prisma migrations and an explicit schema-checked baseline for existing 1.11.0 databases.
- Side-effect-free `/api/ready` endpoint, Docker readiness checks, updater regression checks and disposable database/image backup-restore tests.

### Changed
- Manual `docker compose pull app` / `up` updates remain supported through `latest`, which is promoted only after stable-release verification. Automatic updates remain opt-in and use persistent `SHOOT_IT_IMAGE` digest pinning in `.env`.
- Release CI publishes the updater manifest only after tests, image publication and runtime verification; `main` builds no longer overwrite a stable image tag.
- Docker startup uses the bundled, locked Prisma CLI and `migrate deploy` instead of downloading Prisma and running `db push`.

### Fixed
- Health endpoint version now comes from `package.json`.
- New PostgreSQL 18 installations mount `/var/lib/postgresql` via `.env.example`; existing mount paths stay unchanged until an explicit, backed-up storage migration.
- Docker build context excludes local generated files and uploaded media.

## [1.11.0] - 2026-09-30

### Added
- Admin dashboard with user/project counts, recent users, and registration modes: open, closed, or invitation only.
- Single-use invitation codes with expiry, revocation, and hashed storage; invitation redemption and account creation are atomic.
- Dedicated admin permission, server-side authorization, and explicit grant/revoke commands for existing accounts.
- German and English UI, additive database upgrade script, and registration regression checks.

### Changed
- Signup pages reflect the registration policy; both password and Google OAuth account creation enforce it. Existing accounts can still sign in.

## [1.10.1] - 2026-06-18

### Fixed
- **Guest rating "Not authenticated" error**: Rating an image in a public selection gallery could fail with an authentication error even though guest selection was enabled. The cause was that the rating path (authenticated vs. guest) was chosen based on whether the visitor was logged in, rather than whether they actually had access to the project — so any logged-in user without project access was blocked instead of being treated as a guest. Both the API and the public gallery now decide based on project access: members rate as themselves, everyone else rates as a guest when guest selection is enabled. Logged-in users who lack permission to rate now see a clear "no permission" message instead of a misleading "login to rate" prompt.

## [1.10.0] - 2026-06-01

### Added
- **Direct file download**: Downloads in the public selection and the results view can now be saved directly to a chosen folder as individual files (toggle "Individual files"), recreating the folder structure on disk instead of producing a ZIP. Available in Chromium-based browsers (Chrome/Edge); other browsers automatically use ZIP.

### Fixed
- **Large download stability**: ZIP downloads (selection, results, moodboards) no longer overload the server on big folders. Archives are now streamed without compression (already-compressed photos/videos gained nothing from it) and with proper backpressure, so CPU and memory stay bounded and large downloads complete reliably. Folder structure is preserved.

## [1.9.0] - 2026-06-01

### Added
- **Video Upload & Playback**: Moodboards and Results now support video files (MP4, WebM, MOV) alongside images. Videos play muted as a preview when hovering over them in the gallery and open in the lightbox with full controls and sound on click. A poster frame is generated server-side via ffmpeg, and a duration badge is shown on each video. Works in both the authenticated app and public sharing views (max. 100MB per file).
- **Selection Downloads**: New per-project option ("Allow Downloads" in the Visibility settings) that lets visitors download the public selection images. When enabled, each image gets a download button on hover, images can be marked with checkboxes and downloaded together as a ZIP ("Download selected"), the whole view can be downloaded at once ("Download all"), and single images can be downloaded from the lightbox. Disabled by default; downloads are gated server-side.

### Changed
- **File serving** (`/api/uploads`) now supports HTTP Range requests, enabling video seeking in the player.

## [1.8.7] - 2026-01-21

### Fixed
- **Multiple File Drag & Drop**: Fixed an issue where dragging multiple files into the upload area sometimes only uploaded the first file. This was due to browser data transfer items being cleared prematurely during asynchronous operations; the logic now correctly captures all items synchronously first.

## [1.8.6] - 2026-01-21

### Changed
- **Results View Layout**: The "Results" view (Dashboard & Public) now correctly respects the project's configured Global Gallery Style (Grid, Masonry, Justified), matching the behavior of the Selection view.

## [1.8.5] - 2026-01-21

### Changed
- **Project Settings UI**: Redesigned the Project Form (Edit/Create) to use a Tabbed interface ("Details", "Settings", "Visibility"). This greatly improves usability on mobile devices by reducing scrolling and organizing complex settings logically.

## [1.8.4] - 2026-01-18

### Changed
- **Results View UI**: Completely overhauled the Results View (Dashboard & Public) to match the Selection Gallery consistency. It now features the same sidebar folder navigation, grid layout, and image cards.

### Fixed
- **Drag & Drop**: Improved robustness of the drag and drop area to reliably handle multiple files and folder uploads.
- **Selection Markings**: Restored the colored border markings (ratings) and selection indicators in the gallery view.
- **Filtering Error**: Fixed a server-side exception that occurred when applying star or color filters in the Selection View.
- **Translations**: Added missing translation for `uploadToCurrent`.
- **Public View Consistency**: Fixed layout issues and build errors in the public results view to align with the new sidebar design.

## [1.8.2] - 2026-01-18

### Added
- **Optional Folder Structure**: The hierarchical folder system can now be toggled on/off per project in the settings.

### Changed
- **Public Folder Navigation**: Moved the folder menu from the sidebar to a horizontal pill-based menu above the gallery for a cleaner look.

## [1.8.1] - 2026-01-18

### Added
- **Public Selection Folders**: Hierarchical folder structure is now also visible and navigable on the public selection page.
- **Unassigned Images Filter**: Added an option to view images that are not assigned to any folder in both admin and public views.

## [1.8.0] - 2026-01-18

### Added

- **Selection Folders**:
  - Implemented hierarchical folder structure for selection images.
  - Added support for folder-specific uploads and directory uploads (with automatic folder creation).
  - Integrated Drag & Drop for organizing images between folders.
  - Added bulk management: select multiple images to move or delete at once.
  - New recursive folder navigation sidebar in the selection view.

### Changed

- Updated `SelectionContent` and `ImageCard` to support folder-based organization.
- Enhanced `RatingControls` integration in Selection gallery and lightbox.

## [1.7.2] - 2026-01-18

### Changed

- **Lightbox UI Refinement**:
  - Moved rating controls in the lightbox to be positioned directly underneath the image for better usability.
  - Implemented custom slide rendering for `yet-another-react-lightbox` to achieve consistent layout.

## [1.7.1] - 2026-01-18

### Added

- **Guest Selection Support**:
  - Implemented `allowGuestSelection` project setting.
  - Enabled non-logged in users (guests) to rate and mark images in the selection gallery.
  - Persistent guest identification via secure cookies.
  - Public selection view now pre-renders guest ratings on the server.

## [1.7.0] - 2026-01-18

### Added

- **Public Selection Interaction**:
  - Added ability to rate and mark images directly on the public project page (for logged-in users).
  - Integrated `RatingControls` into the Lightbox for both public and dashboard views.
  - New `PublicSelection` component for better interactive experience on public links.
- **Refactoring**:
  - Extracted `RatingControls` into a standalone component for better reusability.

## [1.6.0] - 2026-01-18

### Added

- **Performance Optimization (Thumbnails)**:
  - Implemented a comprehensive thumbnail/preview system using Sharp.
  - Automatic WebP preview generation (max 2560px) for all uploaded images (Results, Selection, Moodboards, Applications).
  - On-the-fly preview generation for existing images to ensure immediate performance benefits without migration.
  - Pre-generation of image metadata (width/height) stored in the database for optimized UI layouts.
- **Enhanced Gallery Experience**:
  - UI now prioritizes WebP previews for faster loading and reduced bandwidth.
  - Lightbox and grid views globally updated to use thumbnails.

## [1.5.0] - 2026-01-18

### Added

- **Recursive Folder Upload**:
  - Full support for uploading entire directory structures while maintaining the hierarchy in the database.
  - Implemented directory scanning with support for large folders (bypassing browser 100-file limits).
  - New UI toggle to switch between file and folder upload modes.
- **Lightbox Gallery**: Integrated `yet-another-react-lightbox` into the results grid for full-screen image previews and navigation.
- **Enhanced Results API**:
  - Implemented in-memory locking mechanism to prevent race conditions and duplicate folder creation during parallel uploads.
  - Automatic recursive creation of missing subfolder structures.

### Changed

- **Upload Limits**: Increased max upload size for results to 100MB (10x higher than standard moodboard images).
- **Validation**: Updated `validateUpload` utility to support context-specific file size limits.

### Fixed

- **Result Deletion**: Fixed an issue where deleting a folder left abandoned file records in the database and physical files on disk.
  - Changed `ResultFile` and `ResultFolder` relationship to `onDelete: Cascade`.
  - Updated folder deletion API to recursively clean up physical directories for all subfolders and their contents.

## [1.4.1] - 2026-01-17

### Changed

- **Dependencies**: Updated Next.js to the latest version (16.1.3).

## [1.4.0] - 2026-01-17

### Added

- **Scheduling Module**:
  - Interactive calendar (FullCalendar) for finding common project dates.
  - Drag & Drop slot creation and updating in week view.
  - Participant voting system (Accept/Reject) with full transparency for all members.
  - Public read-only list view of available appointment slots.

### Fixed

- **Prisma Integration**: Resolved `PrismaClientValidationError` in project updates by ensuring Prisma Client is correctly generated and synced with the schema.
- **Dependency Management**: Downgraded Prisma to 6.19.2 to maintain compatibility with existing `schema.prisma` configuration and avoid breaking changes in Prisma 7.
- **UI Consistency**: Fixed translations and visibility toggles for the appointments module in project settings.

## [1.3.1] - 2026-01-17

### Added

- **Private Collection UX**: Parity with project view (Search, Sort by Favorites/Date/Name, Expand/Collapse).

## [1.3.0] - 2026-01-17

### Added

- **Favorites & Sorting**:
  - Ability to mark moodboards as favorites (persisted in DB).
  - Sorting options: Favorites first, Newest, Oldest, Alphabetical.
  - Search bar now supports real-time filtering with current sort state.
  - **Sticky Navigation**: Global header and dashboard headers are now sticky for better navigation.

### Fixed

- **UI Overlay**: Fixed z-index of UserMenu to prevent overlap from moodboard headers.
- **Header Clarity**: Fixed image count localization string in all views.
- **Favorites Logic**: Hearts for favoriting are now restricted to the owner's private collection view.

## [1.2.0] - 2026-01-17

### Added

- **Enhanced Moodboard UX**:
  - Integrated Search Bar to filter groups by name or description.
  - Collapsible MoodboardGroups to improve vertical scroll navigation.
  - "Collapse All" / "Expand All" global toggle.
  - Sticky headers for MoodboardGroups to maintain context while scrolling.
  - Image counts displayed in group headers.

## [1.1.1] - 2026-01-17

### Changed

- Footer versioning is now dynamic, reading directly from `package.json`.
- Updated `AGENTS.md` to ensure versioning and changelog are always maintained.

## [1.1.0] - 2026-01-17

### Added

- **Moodboard Image Management**:
  - Download multiple images as ZIP (server-side streaming).
  - Delete multiple images (DB and filesystem).
  - Selection mode for images in MoodboardGroups.
  - Hover actions for single image download/delete.
- **Global Footer**:
  - Added a global footer to the application layout.
  - Displays "Made with ❤️ for photographers and creative teams".
  - Displays current application version.

### Changed

- Application layout changed from `min-h-screen` to a flex-based layout to support fixed/sticky footer positioning.

## [1.0.4] - 2026-01-04 (and prior)

### Fixed

- Various stability improvements and module completion.
