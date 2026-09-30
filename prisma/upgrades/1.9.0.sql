-- Additive, repeatable bridge from the stock 1.8.x / 1.9.x schemas.
-- No rows, columns, indexes or existing values are removed.
BEGIN;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "brandingColor" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "brandingImage" TEXT;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "brandingColor" TEXT;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "brandingImage" TEXT;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "allowSelectionDownload" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "showSelectionFolders" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "MoodboardImage" ADD COLUMN IF NOT EXISTS "isVideo" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "MoodboardImage" ADD COLUMN IF NOT EXISTS "duration" DOUBLE PRECISION;
ALTER TABLE "ResultFile" ADD COLUMN IF NOT EXISTS "isVideo" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ResultFile" ADD COLUMN IF NOT EXISTS "duration" DOUBLE PRECISION;
COMMIT;
