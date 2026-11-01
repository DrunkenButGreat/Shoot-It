-- Keep every existing folder and image. Rename duplicate siblings before adding indexes.
DO $$
DECLARE t text; r record; candidate text; taken boolean; suffix integer;
BEGIN
  FOREACH t IN ARRAY ARRAY['SelectionFolder', 'ResultFolder'] LOOP
    FOR r IN EXECUTE format('SELECT id, name, "projectId", "parentId" FROM (SELECT *, row_number() OVER (PARTITION BY "projectId", "parentId", name ORDER BY "createdAt", id) AS n FROM %I) f WHERE n > 1', t) LOOP
      candidate := r.name || ' (' || r.id || ')';
      suffix := 0;
      LOOP
        EXECUTE format('SELECT EXISTS (SELECT 1 FROM %I WHERE "projectId" = $1 AND "parentId" IS NOT DISTINCT FROM $2 AND name = $3 AND id <> $4)', t) INTO taken USING r."projectId", r."parentId", candidate, r.id;
        EXIT WHEN NOT taken;
        suffix := suffix + 1;
        candidate := r.name || ' (' || r.id || '-' || suffix || ')';
      END LOOP;
      EXECUTE format('UPDATE %I SET name = $1 WHERE id = $2', t) USING candidate, r.id;
    END LOOP;
    EXECUTE format('WITH RECURSIVE tree AS (SELECT id, ''/'' || name AS new_path FROM %I WHERE "parentId" IS NULL UNION ALL SELECT f.id, tree.new_path || ''/'' || f.name FROM %I f JOIN tree ON f."parentId" = tree.id) UPDATE %I f SET path = tree.new_path FROM tree WHERE f.id = tree.id', t, t, t);
    EXECUTE format('CREATE UNIQUE INDEX %I ON %I ("projectId", name) WHERE "parentId" IS NULL', t || '_root_name_key', t);
    EXECUTE format('CREATE UNIQUE INDEX %I ON %I ("projectId", "parentId", name) WHERE "parentId" IS NOT NULL', t || '_child_name_key', t);
  END LOOP;
END $$;

CREATE TABLE "FileCleanupJob" (
  "path" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FileCleanupJob_pkey" PRIMARY KEY ("path")
);

CREATE INDEX "SelectionImage_path_idx" ON "SelectionImage" ("path");
CREATE INDEX "SelectionImage_thumbnail_idx" ON "SelectionImage" ("thumbnail");
CREATE INDEX "ResultFile_path_idx" ON "ResultFile" ("path");
CREATE INDEX "ResultFile_thumbnail_idx" ON "ResultFile" ("thumbnail");
CREATE INDEX "MoodboardImage_path_idx" ON "MoodboardImage" ("path");
CREATE INDEX "MoodboardImage_thumbnail_idx" ON "MoodboardImage" ("thumbnail");
CREATE INDEX "ParticipantImage_path_idx" ON "ParticipantImage" ("path");
CREATE INDEX "ParticipantImage_thumbnail_idx" ON "ParticipantImage" ("thumbnail");
CREATE INDEX "ApplicationImage_path_idx" ON "ApplicationImage" ("path");
CREATE INDEX "ApplicationImage_thumbnail_idx" ON "ApplicationImage" ("thumbnail");
