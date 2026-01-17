# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
