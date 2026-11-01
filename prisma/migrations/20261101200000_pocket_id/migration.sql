BEGIN;
CREATE TABLE "PocketIdSettings" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "issuer" TEXT NOT NULL DEFAULT '',
    "clientId" TEXT NOT NULL DEFAULT '',
    "clientSecret" TEXT,
    CONSTRAINT "PocketIdSettings_pkey" PRIMARY KEY ("id")
);
COMMIT;
