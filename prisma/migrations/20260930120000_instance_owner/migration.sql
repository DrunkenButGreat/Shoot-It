BEGIN;

ALTER TABLE "User" ADD COLUMN "isOwner" BOOLEAN NOT NULL DEFAULT false;

-- Existing installations: promote the oldest account without changing any other
-- admin grants or project ownership. The ID breaks equal timestamp ties.
UPDATE "User"
SET "isOwner" = true, "isAdmin" = true
WHERE "id" = (SELECT "id" FROM "User" ORDER BY "createdAt", "id" LIMIT 1);

COMMIT;
