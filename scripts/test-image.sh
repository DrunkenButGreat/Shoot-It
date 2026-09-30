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
# Internal network also proves startup/migrations need no npm registry access.
docker network create --internal "$name" >/dev/null
docker volume create "$name-uploads" >/dev/null
docker run -d --name "$name-db" --network "$name" --network-alias db \
  -e POSTGRES_PASSWORD=synthetic-only -e POSTGRES_DB=shootit_smoke_test postgres:18-alpine >/dev/null
for attempt in $(seq 1 60); do
  if docker exec "$name-db" pg_isready -U postgres >/dev/null 2>&1; then break; fi
  sleep 1
done
docker run -d --name "$name-app" --network "$name" -v "$name-uploads:/app/uploads" \
  -e DATABASE_URL=postgresql://postgres:synthetic-only@db:5432/shootit_smoke_test \
  -e AUTH_SECRET=synthetic-smoke-test-secret-at-least-32-characters \
  -e AUTH_URL=http://localhost:3000 "$image" >/dev/null
healthy=false
for attempt in $(seq 1 90); do
  if [ "$(docker inspect --format '{{.State.Health.Status}}' "$name-app")" = healthy ]; then healthy=true; break; fi
  sleep 2
done
if [ "$healthy" != true ]; then docker logs "$name-app"; exit 1; fi
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
docker start "$name-app" >/dev/null
for attempt in $(seq 1 60); do
  if docker exec "$name-app" node scripts/healthcheck.cjs; then break; fi
  sleep 2
done
docker exec "$name-app" node scripts/healthcheck.cjs
docker stop "$name-db" >/dev/null
if docker exec "$name-app" node scripts/healthcheck.cjs; then
  echo 'Readiness incorrectly succeeded without a database' >&2
  exit 1
fi
echo 'PASS: locked offline startup, fresh/repeated migration, healthcheck, database and uploads backup/restore, DB outage detection.'
