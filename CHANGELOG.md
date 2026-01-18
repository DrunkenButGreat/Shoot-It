# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
