# Docker updates

There are two update paths: manual app-image replacement and the optional
[Docker autoupdate container](docker-compose.updater.yml). The app migrates its
database before starting the web server. The separate Linux host/systemd updater
has been retired.

For QNAP / Container Station, use the [container instructions](QNAP-UPDATES.md).
They cover app-start migration, the updater's `check`, `run`, `watch` and `migrate`
commands, backup locations and recovery without host Python or systemd.

## Manual updates without the updater

Keep a current database/uploads backup, then replace only the app:

```sh
docker compose pull app
docker compose up -d --no-deps --wait --wait-timeout 120 app
```

Use the image's default command. `latest` follows tested stable GitHub releases;
for a fixed version set `SHOOT_IT_IMAGE=ghcr.io/drunkenbutgreat/shoot-it:<version>`
in `.env`. A fixed digest does not change when pulled.

From 1.16.0, stock 1.8.x–1.11.x databases receive a verified database backup and
migration baseline automatically at app startup. Fresh and already migrated
installations apply their pending migrations. The web server starts only after
success. Large first-time backups can outlast the Compose wait timeout; inspect
the app logs and let the migration finish instead of interrupting it.

This path creates a database backup only for the initial legacy transition. It
does not archive uploads or automatically roll back subsequent manual updates.
See [startup backup and recovery](QNAP-UPDATES.md#automatic-migration-at-app-start-1160).

## Automatic updates with the Docker container

Create a separate updater application from [docker-compose.updater.yml](docker-compose.updater.yml).
Set `APP_CONTAINER` and `DB_CONTAINER` to the existing container names and keep a
persistent `/data` volume for state and backups. On Linux the same YAML can be
started with `docker compose -f deploy/docker-compose.updater.yml up -d`.

- `check`: validate the installation and inspect the available release.
- `run`: back up and update once; the supplied YAML uses this mode by default.
- `watch`: check every 15 minutes within `UPDATE_WINDOW`; set `restart: unless-stopped`.
- `migrate`: back up and migrate only the database; leave the old app stopped.

For settings, prerequisites, time windows and failure handling, use the
[Docker updater guide](QNAP-UPDATES.md). The updater replaces only the app; it
keeps the database container, PostgreSQL version, mounts and existing data.

To return to manual updates, stop scheduled checks after any active update has
finished and disable the updater's restart policy. Retain its `/data` volume.
Resolve unfinished transactions before proceeding. In your saved app YAML or
`.env`, select `latest` or the successfully installed target image before a manual
recreation: the Docker updater does not rewrite those files or Container Station's
saved configuration. A stale tag/digest could otherwise reinstall an older image.

## Preserve existing PostgreSQL storage

Schema migration does not move PostgreSQL data. Keep the existing DB container and
actual mounts, including legacy anonymous volumes. Do not recreate the database,
use `down -v`, prune volumes or change the mount destination during an app update.

New PostgreSQL 18 installations use `POSTGRES_VOLUME_TARGET=/var/lib/postgresql`.
Existing installations preserve their old setting until storage is deliberately
migrated. If necessary, restore a verified dump into a separate new named volume
with the correct PostgreSQL layout, verify records and the actual data directory,
and only then switch the app. Retain the original volume for recovery.

## Retire an existing host updater

Removing the old files from this checkout does not disable an already installed
systemd service. On a host that previously used it, disable future timer runs:

```sh
sudo systemctl disable --now shoot-it-updater.timer
systemctl is-active shoot-it-updater.service
```

Let an active service finish; do not stop it during backup or migration. Check its
existing transaction journal (default `/var/lib/shoot-it-updater/transaction.json`)
before enabling the Docker updater. An unfinished migration still needs recovery.
Keep the old configuration and backups; the [1.16 host recovery guide](https://github.com/DrunkenButGreat/Shoot-It/blob/v1.16.0/deploy/UPDATES.md#logs-backups-and-recovery)
remains available for those transactions. Do not copy the host journal into the
Docker updater's `/data`: they use different transaction formats.

The old host updater may have pinned `SHOOT_IT_IMAGE` in `.env`. After completing
recovery or a successful update, deliberately select the installed version/digest
or remove that pin to follow `latest` before any manual app recreation. Never run
the host timer and Docker updater against the same installation simultaneously.

## Release maintainer contract

- Update `package.json`/lockfile with SemVer and `CHANGELOG.md`. Publish the exact
  stable tag `v<package version>`; `main` images are development builds.
- Keep `prisma/baseline.prisma`, `prisma/migrations/0_init` and historical upgrade
  SQL. Add ordered migrations for later schema changes and use PostgreSQL DDL
  transactions. Never replace the startup migration with `db push` or a reset.
- `deploy/auto-update.json` controls protocol, supported versions and rollback
  compatibility. Dropped/renamed fields, changed semantics or new required
  configuration need a reviewed compatibility gate, not an unconditional update.
- CI verifies updater policy, migrations, registration and types, then builds and
  tests the app/updater images with disposable PostgreSQL and backup restoration.
  Only after success does it attach `shoot-it-update.json` and promote both images
  to `latest`, provided the release is still GitHub's latest. Stable release runs
  are serialized. Missing manifests and failed tests never advance `latest`.
- Release assets are attached after publication and are never overwritten. If
  repository release immutability is enabled, attach tested assets to a draft
  before publication instead. Correct an invalid contract with a new release.
- Container protocol or infrastructure changes require documented operator steps.
  The updater does not replace itself or recreate the database.

Checks:

```sh
npm run test:updater
node scripts/test-release-workflow.cjs
TEST_DATABASE_URL=postgresql://.../shootit_update_test npm run test:migrations
sh scripts/test-image.sh <app-image>
python3 scripts/test-container-updater.py <app-image> <updater-image>
```
