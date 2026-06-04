# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.10.1] - 2026-06-04

### Fixed
- **Public gallery performance with many images**: The public page (selection, results and moodboard galleries) no longer freezes or loads slowly when a project contains a large number of images or videos. Gallery thumbnails now load lazily (native `loading="lazy"`) so only media near the viewport is fetched as the visitor scrolls, and gallery videos no longer preload their metadata up front (`preload="none"`), drastically reducing the number of simultaneous network requests on first paint. Moodboard grid items also use the generated thumbnail instead of the full-size image.

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
