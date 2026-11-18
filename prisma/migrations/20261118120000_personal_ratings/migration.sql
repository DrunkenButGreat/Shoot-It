BEGIN;
ALTER TABLE "ProofPick" ADD COLUMN stars SMALLINT,
  ADD COLUMN color "RatingColor",
  ADD COLUMN included BOOLEAN NOT NULL DEFAULT true,
  ADD CONSTRAINT "ProofPick_stars_check" CHECK (stars BETWEEN 1 AND 5);

-- The old shared row records only its last writer; never guess earlier authors.
CREATE TEMP TABLE previous_ratings ON COMMIT DROP AS
SELECT i."projectId", r."imageId", r.stars, r.color,
  CASE WHEN r."userId" IS NOT NULL THEN 'user:' || r."userId"
       ELSE 'legacy:' || md5(coalesce(r."guestId",'unattributed')) END AS actor,
  coalesce(u.name,u.email,'') AS name
FROM image_rating r JOIN "SelectionImage" i ON i.id=r."imageId"
LEFT JOIN "User" u ON u.id=r."userId"
WHERE r.stars IS NOT NULL OR r.color IS NOT NULL;

INSERT INTO "ProofList" (id,"projectId",actor,name)
SELECT DISTINCT 'rating_' || md5("projectId" || ':' || actor),"projectId",actor,name FROM previous_ratings
ON CONFLICT ("projectId",actor) DO NOTHING;
INSERT INTO "ProofPick" ("listId","imageId",stars,color,included)
SELECT l.id,r."imageId",r.stars,r.color,l."submittedAt" IS NULL FROM previous_ratings r
JOIN "ProofList" l ON l."projectId"=r."projectId" AND l.actor=r.actor
ON CONFLICT ("listId","imageId") DO UPDATE SET stars=excluded.stars,color=excluded.color;
-- An old heart without an attributed rating becomes a green mark, never invented stars.
UPDATE "ProofPick" SET color='GREEN' WHERE stars IS NULL AND color IS NULL;
COMMIT;
