#!/bin/sh
# Full runtime smoke check against disposable containers and synthetic data only.
set -eu
image=${1:?Usage: sh scripts/test-image.sh IMAGE}
name="shoot-it-smoke-$$"
work=$(mktemp -d)
cleanup() {
  docker rm -f -v "$name-app" "$name-db" >/dev/null 2>&1 || true
  docker volume rm "$name-uploads" >/dev/null 2>&1 || true
  docker network rm "$name" >/dev/null 2>&1 || true
  rm -rf "$work"
}
trap cleanup EXIT INT TERM
wait_ready() {
  for attempt in $(seq 1 90); do
    if [ "$(docker inspect --format '{{.State.Health.Status}}' "$name-app")" = healthy ]; then return; fi
    if [ "$(docker inspect --format '{{.State.Running}}' "$name-app")" = false ]; then break; fi
    sleep 2
  done
  docker logs "$name-app"
  return 1
}
sql() { docker exec "$name-db" psql -U postgres -d shootit_smoke_test -v ON_ERROR_STOP=1 -Atc "$1"; }
# Internal network also proves startup/migrations need no npm registry access.
docker network create --internal "$name" >/dev/null
docker volume create "$name-uploads" >/dev/null
docker run -d --name "$name-db" --network "$name" --network-alias db \
  -e POSTGRES_PASSWORD=synthetic-only -e POSTGRES_DB=shootit_smoke_test postgres:18-alpine >/dev/null
for attempt in $(seq 1 60); do
  if docker exec "$name-db" pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1; then break; fi
  sleep 1
done
docker run -d --name "$name-app" --network "$name" -v "$name-uploads:/app/uploads" \
  -e DATABASE_URL=postgresql://postgres:synthetic-only@db:5432/shootit_smoke_test \
  -e AUTH_SECRET=synthetic-smoke-test-secret-at-least-32-characters \
  -e AUTH_URL=http://localhost:3000 "$image" >/dev/null
wait_ready
docker exec "$name-app" node scripts/migrate.cjs deploy
docker exec "$name-app" node -e 'const {PrismaClient}=require("@prisma/client");const p=new PrismaClient();p.user.create({data:{email:"preserved@example.test",isAdmin:true}}).finally(()=>p.$disconnect())'
docker exec "$name-app" sh -c 'printf "synthetic-upload\n" > /app/uploads/smoke.txt'
docker stop "$name-app" >/dev/null
docker exec "$name-db" pg_dump -U postgres -d shootit_smoke_test -Fc > "$work/database.dump"
docker run --rm --network none --user 0 --volumes-from "$name-app:ro" --entrypoint tar "$image" -C /app/uploads -cf - . > "$work/uploads.tar"
tar -tf "$work/uploads.tar" | grep 'smoke.txt' >/dev/null
docker exec "$name-db" createdb -U postgres shootit_restore_test
docker exec -i "$name-db" pg_restore -U postgres -d shootit_restore_test --exit-on-error < "$work/database.dump"
restored=$(docker exec "$name-db" psql -U postgres -d shootit_restore_test -Atc 'SELECT COUNT(*) FROM "User" WHERE email = '\''preserved@example.test'\'' AND "isAdmin" = true')
[ "$restored" = 1 ]
mkdir "$work/restored"
tar -xf "$work/uploads.tar" -C "$work/restored"
[ "$(cat "$work/restored/smoke.txt")" = synthetic-upload ]
# Recreate the stock 1.8 schema, retaining the existing user and uploads.
sql 'DROP TABLE "_prisma_migrations"; DROP TABLE "RegistrationInvite"; DROP TABLE "RegistrationSettings";
DROP TYPE "RegistrationMode"; ALTER TABLE "User" DROP COLUMN "isAdmin", DROP COLUMN "isOwner", DROP COLUMN "brandingColor", DROP COLUMN "brandingImage";
ALTER TABLE "Project" DROP COLUMN "brandingColor", DROP COLUMN "brandingImage", DROP COLUMN "allowSelectionDownload", DROP COLUMN "showSelectionFolders";
ALTER TABLE "MoodboardImage" DROP COLUMN "isVideo", DROP COLUMN "duration";
ALTER TABLE "ResultFile" DROP COLUMN "isVideo", DROP COLUMN "duration";' >/dev/null
# A missing/unwritable backup destination must not change the old schema.
docker run --rm --network none --user 0 -v "$name-uploads:/app/uploads" --entrypoint chmod "$image" 0555 /app/uploads
if docker start -a "$name-app"; then echo 'Startup ignored backup failure' >&2; exit 1; fi
[ "$(sql "SELECT COUNT(*) FROM information_schema.columns WHERE table_name='User' AND column_name='isAdmin'")" = 0 ]
docker run --rm --network none --user 0 -v "$name-uploads:/app/uploads" --entrypoint chmod "$image" 0755 /app/uploads
docker start "$name-app" >/dev/null
wait_ready
[ "$(sql 'SELECT COUNT(*) FROM "User" WHERE email = '\''preserved@example.test'\'' AND "isAdmin" = true AND "isOwner" = true')" = 1 ]
backup=$(docker exec "$name-app" node -e 'const fs=require("fs"),d="/app/uploads/.shoot-it-migrations";const a=fs.readdirSync(d);if(a.length!==1||!a[0].startsWith("legacy-"))throw Error("Unexpected backup/journal");console.log(d+"/"+a[0]+"/database.dump")')
docker cp "$name-app:$backup" "$work/startup.dump"
docker exec "$name-db" createdb -U postgres shootit_legacy_restore_test
docker exec -i "$name-db" pg_restore -U postgres -d shootit_legacy_restore_test --exit-on-error < "$work/startup.dump"
[ "$(docker exec "$name-db" psql -U postgres -d shootit_legacy_restore_test -Atc 'SELECT email FROM "User"')" = preserved@example.test ]
[ "$(docker exec "$name-db" psql -U postgres -d shootit_legacy_restore_test -Atc "SELECT COUNT(*) FROM information_schema.columns WHERE table_name='User' AND column_name='isAdmin'")" = 0 ]
# Backups are private even with guessed paths or a symlink alias.
docker exec "$name-app" node -e 'const fs=require("fs");fs.symlinkSync(process.argv[1],"/app/uploads/backup-alias.dump");' "$backup"
docker exec "$name-app" node -e 'const assert=require("assert");(async()=>{for(const p of [process.argv[1].replace("/app/uploads/",""),"backup-alias.dump"]){assert.equal((await fetch("http://localhost:3000/api/uploads/"+p)).status,403)}assert.equal(await(await fetch("http://localhost:3000/api/uploads/smoke.txt")).text(),"synthetic-upload\n")})().catch(e=>{console.error(e);process.exit(1)})' "$backup"
docker restart "$name-app" >/dev/null
wait_ready
docker exec "$name-app" node -e 'if(require("fs").readdirSync("/app/uploads/.shoot-it-migrations").length!==1)throw Error("Repeated backup")'
docker exec "$name-app" node scripts/healthcheck.cjs
docker stop "$name-db" >/dev/null
if docker exec "$name-app" node scripts/healthcheck.cjs; then
  echo 'Readiness incorrectly succeeded without a database' >&2
  exit 1
fi
docker stop "$name-app" >/dev/null
docker start "$name-db" >/dev/null
for attempt in $(seq 1 60); do
  if docker exec "$name-db" pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1; then break; fi
  sleep 1
done
# Unexpected legacy drift fails closed, retaining the original backup and journal.
sql 'DROP TABLE "_prisma_migrations"; ALTER TABLE "User" DROP COLUMN "bio";' >/dev/null
if docker start -a "$name-app"; then echo 'Startup accepted schema drift' >&2; exit 1; fi
if docker start -a "$name-app"; then echo 'Startup ignored interrupted migration' >&2; exit 1; fi
docker run --rm --network none -v "$name-uploads:/app/uploads" --entrypoint node "$image" -e 'const fs=require("fs"),d="/app/uploads/.shoot-it-migrations";if(!fs.existsSync(d+"/pending.json")||fs.readdirSync(d).length!==3)throw Error("Missing journal or repeated failed backup")'
echo 'PASS: offline startup, fresh/legacy/repeated migration, backup failure/drift/interruption guards, private/restorable backups, healthcheck, DB outage and uploads preservation.'
