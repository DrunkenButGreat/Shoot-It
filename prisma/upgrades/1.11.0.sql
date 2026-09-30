-- Additive, repeatable upgrade for installations using `prisma db push`.
BEGIN;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isAdmin" BOOLEAN NOT NULL DEFAULT false;
DO $$ BEGIN
  CREATE TYPE "RegistrationMode" AS ENUM ('OPEN', 'CLOSED', 'INVITE_ONLY');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE TABLE IF NOT EXISTS "RegistrationSettings" (
  "id" TEXT NOT NULL DEFAULT 'global',
  "mode" "RegistrationMode" NOT NULL DEFAULT 'OPEN',
  CONSTRAINT "RegistrationSettings_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "RegistrationInvite" (
  "id" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  CONSTRAINT "RegistrationInvite_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "RegistrationInvite_codeHash_key" ON "RegistrationInvite"("codeHash");
INSERT INTO "RegistrationSettings" ("id", "mode") VALUES ('global', 'OPEN') ON CONFLICT ("id") DO NOTHING;
COMMIT;
