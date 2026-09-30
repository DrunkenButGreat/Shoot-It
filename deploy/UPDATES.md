# Manual and automatic Docker Compose updates

Version 1.12.0 introduces an **opt-in Linux host updater**. After the one-time
setup, operators no longer need to pull or replace app images themselves.
Default: check every 15 minutes, install between **03:00 and 05:00 host local time**.
The app is unavailable during the consistent backup, migration and restart.
Backup duration depends on the amount of media; this is not zero-downtime deployment.

## Manual updates without the updater

Manual updates remain the default and need only Docker Compose. There is no
requirement to install Python, systemd or the host updater. After the one-time
1.12.0 database transition below, the familiar update path remains available:

```sh
docker compose pull app
docker compose up -d --no-deps --wait --wait-timeout 120 app
```

Take a database/uploads backup before updating (use the stopped-app backup procedure
in the transition section). `latest` points to the latest tested stable GitHub
release; development builds never advance it. The container applies pending
migrations at startup, and `--no-deps` leaves the running database container alone.
This manual path does not create updater backups or automatically roll back failures.
Read the release notes first, especially for major releases or infrastructure changes.

For a selected version instead of `latest`, set exactly one `SHOOT_IT_IMAGE` entry
in `.env`, for example `SHOOT_IT_IMAGE=ghcr.io/drunkenbutgreat/shoot-it:1.12.0`,
then run the same commands. Change that value when choosing the next version.
A fixed digest intentionally keeps the same image even after `pull`.

### Switch from automatic back to manual updates

1. Disable future runs: `sudo systemctl disable --now shoot-it-updater.timer`.
2. Let an already running update finish; disabling the timer does not stop its
   service. Check `systemctl is-active shoot-it-updater.service` and the journal.
   Do not interrupt migrations. If `transaction.json` reports an unfinished or
   failed migration, complete the recovery procedure below before continuing.
3. Remove the updater's `SHOOT_IT_IMAGE` line from `.env` to return to `latest`,
   or replace it with the explicit version you intend to install. Also remove
   any shell override for this variable. Keep all other settings and volumes.
4. Back up, then use the manual Compose commands above. Review any release that
   previously rolled back before explicitly retrying it manually.

The installed script and backups can remain on the host; nothing runs automatically
while the timer is disabled. To opt in again after a successful manual update,
rerun `sudo sh scripts/install-updater.sh`; it validates and pins the running image
and re-enables the timer. Unresolved transactions must be recovered first.

## Requirements for automatic updates

- Linux with systemd, Python 3.9+, a **local** Docker engine and Compose v2 supporting
  `up --wait` (2.20+ recommended). The current release workflow builds linux/amd64.
- A single Shoot-It Compose installation with services named `app` and `db`,
  PostgreSQL, persistent `/app/uploads`, and the stock image command/healthcheck.
- A running, baselined version **1.12.0 or newer**. Older installations follow the
  transition below first. The first updater release does not update itself from 1.11.0.
- The installation directory, Compose files and `.env` must only be writable by
  trusted administrators: the updater runs with host Docker privileges.
- Backups on durable storage, capacity monitoring, and an independently retained
  off-host backup. Update backups are never automatically deleted.
- Registry pull access. Public GHCR images need no login; private packages require
  a read-only registry login for the root account used by the service.

The application does not receive a Docker socket or host credentials. The installed
host script is not downloaded or replaced automatically by releases. Protocol changes
require an explicit host-updater upgrade.

## New installations

After **v1.12.0 has been published successfully**, follow the normal Compose setup
with the files from that release. `docker compose up -d` creates the empty database,
executes the migration history and starts the app. To opt into automatic updates:

```sh
sudo sh scripts/install-updater.sh
systemctl status shoot-it-updater.timer
sudo python3 /usr/local/lib/shoot-it/update.py check
```

The installer validates readiness and persistent database storage, pins the current
image in `.env` (`SHOOT_IT_IMAGE`), installs the script and enables the timer. Ordinary
`docker compose up` commands continue to use that pin. Do not override this variable
in the shell or hardcode `app.image` in a Compose override.

Configuration: `/etc/shoot-it-updater.json`. It contains the installation directory,
explicit Compose files, state directory, backup directory and maintenance hours.
The installer includes `docker-compose.override.yml` if present. Add other required
Compose files before enabling the timer if you use a customized installation.
Existing configuration is preserved when the installer is run again.

Change `windowHours` to e.g. `[1, 3]`; equal hours allow updates at any time.
For a private repository, create `/etc/shoot-it-updater.env`, mode `0600`, containing
`GITHUB_TOKEN=...` with read-only repository contents access. Never put it into the
application's environment. For manual checks, use the same credential environment.
No token is forwarded when GitHub redirects an asset download to storage.

## Existing installations: one-time transition

Do this during a maintenance window. Keep the existing running database container
until its actual storage location has been checked. **Do not run a blanket Compose
`up`, `down -v`, volume prune or database recreation during this transition.**
New installations set `POSTGRES_VOLUME_TARGET=/var/lib/postgresql` in `.env`.
Existing installations without that variable retain the previous mount path.
Changing it from `/var/lib/postgresql/data` before moving the actual data could
otherwise expose an empty database. Do not replace your existing `.env` with the example.

1. Start from a working **1.11.0** schema. Earlier versions first follow the existing
   1.11.0 upgrade instructions. Record the running app image ID and database mounts:

   ```sh
   docker inspect photoshoot-app --format '{{.Image}}'
   docker inspect photoshoot-db --format '{{json .Mounts}}'
   docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "SHOW data_directory"'
   ```

2. Stop only the app and make a consistent backup using the currently working
   Compose configuration. Keep `.env` and the original Compose files alongside it
   with restrictive permissions. Example for the standard service/container names:

   ```sh
   umask 077
   mkdir -p transition-backup
   docker compose stop app
   docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > transition-backup/database.dump
   docker compose exec -T db pg_restore --list < transition-backup/database.dump
   old_image=$(docker inspect photoshoot-app --format '{{.Image}}')
   docker run --rm --network none --user 0 --volumes-from photoshoot-app:ro --entrypoint tar "$old_image" -C /app/uploads -cf - . > transition-backup/uploads.tar
   tar -tf transition-backup/uploads.tar > /dev/null
   ```

   Verify command success and rehearse restoring the database into a separate
   disposable database before proceeding. These archives contain personal data.

3. If `SHOW data_directory` is not inside the expected **named** volume, migrate
   storage first. Use a **new named volume**, mount it at `/var/lib/postgresql`,
   initialize PostgreSQL 18 there, then restore the dump with `pg_restore
   --exit-on-error --no-owner --no-acl`. Set `volumes.db_data.name` in your local
   Compose override to that new volume, set `POSTGRES_VOLUME_TARGET=/var/lib/postgresql`
   in `.env`, and preserve the original volumes for recovery.
   Also migrate deliberately if the old volume layout does not match PostgreSQL 18.
   Never just rename the mount and assume the files moved. Recheck table counts,
   representative records and `SHOW data_directory` before using the new database.
   The updater refuses storage that does not match the declared persistent mount.

4. Use the 1.12.0 Compose file and app image, retaining your local settings and
   verified volume configuration. Set `SHOOT_IT_IMAGE=ghcr.io/drunkenbutgreat/shoot-it:1.12.0`
   in `.env` to explicitly select the transition release, even if `latest` has
   advanced. Pull only the app,
   explicitly baseline the existing schema, then deploy the migration history:

   ```sh
   docker compose pull app
   docker compose run --rm --no-deps -T app node scripts/migrate.cjs baseline
   docker compose run --rm --no-deps -T app node scripts/migrate.cjs deploy
   docker compose up -d --no-deps --wait --wait-timeout 120 app
   ```

   Baseline compares the existing schema against the frozen 1.11.0 schema and only
   records `0_init` when they match. It neither recreates tables nor resets data.
   A mismatch must be investigated; **never force a baseline to hide it**. Normal
   startup deliberately fails for an unbaselined, nonempty database.

5. Check login, existing projects, image access, and `/api/ready`. For manual updates,
   retain the version pin or remove it to follow `latest`. For automatic updates,
   run the installer above. Keep the transition backup and previous image until verified.

## What happens on an update

1. Fetch the latest published stable GitHub release and its `shoot-it-update.json`.
   Missing assets, drafts, prereleases, older/equal versions, major changes,
   incompatible minimum versions and unknown updater protocols do not install.
2. Require the official GHCR repository and an exact SHA-256 image digest. A release
   is eligible only when `rollbackSafe` is explicitly true. Semantic versions are
   compared numerically. The latest release is checked; there is no older-major
   maintenance-channel search when GitHub marks a new major as latest.
3. Lock the updater, check actual storage and available space, pull the image and
   compare its packaged version. Save the previous local image ID and pin it.
4. Stop the app, dump PostgreSQL and archive uploads. Verify dump readability and
   archive structure. Record backup completion. No migration starts after a failed
   backup; the previous app is restarted instead.
5. Run all pending migrations with the CLI bundled in the target image. There is
   no `db push`, destructive schema synchronization or runtime npm download.
6. Start only the app with the new digest. Docker healthchecks call `/api/ready`,
   which reads the database and returns the packaged version. The legacy
   `/api/health` cleanup behavior remains separate and is not used by the updater.
7. On readiness failure after successful migration, restart the previous image.
   The release version is blocked from automatic retry; a new fixed release can
   proceed. This relies on the release's explicit backward-compatibility contract.

The database container, secrets, Compose files and imported local-media directory
are not automatically upgraded. Releases requiring changes there must disable
automatic eligibility until operators have completed the prerequisite upgrade.
The read-only `local_media` source needs its own backup; managed uploads are archived.

## Logs, backups and recovery

```sh
journalctl -u shoot-it-updater.service
sudo cat /var/lib/shoot-it-updater/transaction.json
sudo systemctl stop shoot-it-updater.timer
sudo systemctl disable shoot-it-updater.timer  # keep automatic updates disabled
```

Backups are under `/var/backups/shoot-it/<timestamp>-<version>/`:
`database.dump`, `uploads.tar`, `previous.env`, `release.json`, and `COMPLETE`.
A `COMPLETE` marker means both archives passed structural checks, not that every
possible restore has been rehearsed. The image ID is in `transaction.json`.
Do not prune the previous image until the release and recovery have been verified.
Backups accumulate intentionally; move/delete old archives under your retention
policy. Low space stops the updater before application downtime.

A migration failure or interrupted transaction **blocks further updates**. A timed-out
Docker migration container might still exist as `shoot-it-update-migration`;
stop the timer, inspect that container and ensure it has stopped before recovery.
Do not automatically start an older image against an unknown schema.

Preferred recovery: investigate the migration, repair it using Prisma's documented
`migrate resolve` workflow, and validate the chosen app version. Alternatively, while
all writers remain stopped, restore the backup into a **new** database volume and
restore uploads into a **new** uploads volume, verify both, then point Compose at
those volumes and pin the previous image from the journal. Keep failed-state volumes
for diagnosis. A restore after accepting new writes would discard those later writes;
reconcile them before deciding to restore.

After readiness and data checks pass, archive (do not blindly delete) the transaction
file outside its active path, then re-enable the timer. A rolled-back release should
remain blocked until a new release is published. Ordinary network failures before
stopping the app can simply retry on the next timer tick.

## Release maintainer contract

- Bump `package.json`/lockfile with SemVer, update `CHANGELOG.md`, and publish the
  exact stable tag `v<package version>`. `main` images are not automatic releases.
- Keep `prisma/baseline.prisma` and `prisma/migrations/0_init` immutable. Add ordered
  migrations for subsequent schema changes; use transactions for PostgreSQL DDL.
- `deploy/auto-update.json` declares updater protocol, minimum compatible version
  and whether **every** supported previous version can still operate after all
  intervening migrations. Test skipped releases as well as adjacent versions.
- Additive nullable fields/tables are usually compatible. Dropping/renaming fields,
  changing stored semantics or requiring new environment variables is not automatically
  safe. Use expand/contract changes, raise `minVersion`, or set `rollbackSafe: false`.
- CI runs updater, migration, registration and TypeScript checks, builds/pushes the
  image, then starts it against disposable PostgreSQL and rehearses backup restoration.
  Only then does it upload the manifest and promote the image to `latest` for manual
  installations, provided GitHub still marks that release as latest. Release runs
  are serialized so an older build cannot overwrite a newer tested `latest` image.
  A failed build/test has no eligible manifest and does not advance `latest`.
- The publication workflow uploads an asset after the `release.published` event;
  repository release immutability must allow this. If immutable releases are enabled,
  build/test and attach assets to a draft before publication instead. Existing assets
  are never overwritten; publish a new version to correct a failed release contract.
- A release needing host-updater or Compose changes requires a documented manual
  step. Do not mark it compatible just to bypass the protocol/minimum gate.

Checks:

```sh
npm run test:updater
TEST_DATABASE_URL=postgresql://.../shootit_update_test npm run test:migrations
sh scripts/test-image.sh ghcr.io/drunkenbutgreat/shoot-it:1.12.0
python3 scripts/test-compose-updater.py ghcr.io/drunkenbutgreat/shoot-it:1.12.0
```

References: [GitHub releases](https://docs.github.com/en/rest/releases/releases),
[Compose readiness](https://docs.docker.com/reference/cli/docker/compose/up/),
[Prisma baseline](https://www.prisma.io/docs/orm/v6/prisma-migrate/workflows/baselining),
[PostgreSQL 18 storage layout](https://hub.docker.com/_/postgres).
