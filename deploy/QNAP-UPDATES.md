# Updates in QNAP Container Station

Available after **1.15.0 or newer is published successfully**. The release builds
both `ghcr.io/drunkenbutgreat/shoot-it` and `ghcr.io/drunkenbutgreat/shoot-it-updater`.
The current publishing workflow targets **linux/amd64 (x86-64 NAS)**. Do not use
these published images on an ARM NAS without a separately tested matching build.

You do not need to know your current Shoot-It version. The updater reads it from
the installed image. It supports the stock 1.10.x–1.x application with PostgreSQL,
including installations created as a Compose application or separate containers.
The application and database must share a user-defined Docker bridge network,
use dynamic IPs, and have persistent uploads/database storage. A stock 1.12+ app
that failed to start because its old database is not baselined is also supported,
even if its installed image is already the latest version.
Older schemas or unrelated schema drift stop the transition for manual review.

## One-time update without SSH

1. In Container Station, find the existing app and database container names.
   Defaults are `photoshoot-app` and `photoshoot-db`. Keep this application and all
   its volumes. Disable any other scheduled updater before using this one.
2. Create a **separate application**, for example `shoot-it-update`, using the YAML
   in [docker-compose.updater.yml](docker-compose.updater.yml). Change
   `APP_CONTAINER` / `DB_CONTAINER` only if your existing names differ.
3. Optionally change `command: ["run"]` to `command: ["check"]` for the first
   start. This checks the installed version, database mapping, actual volumes,
   backup capacity and release contract without stopping/replacing the app or
   applying migrations. It creates only updater lock bookkeeping and temporary
   read-only image inspection containers; it does not pull a new app image.
4. Set `command: ["run"]` and start/recreate **only the updater application**.
   Watch its logs. The existing Shoot-It application is unavailable during the
   backup, migration and restart. A successful run ends with `Updated to …` and
   exits normally. If already current, it exits without another backup/replacement.

No Python installation, `sudo`, `systemctl`, `npx`, host Compose executable, project
directory or `.env` is required. The updater carries its tools and talks to the
existing Docker engine through `/var/run/docker.sock` (API 1.40–1.47, e.g. Docker
19.03 through 27). It needs Docker control permissions; give the socket only to
the updater, not the web application. Do not enable Docker privileged mode.

The default named volume `shoot_it_updater_data` stores state and backups. For
backups visible in File Station, replace `updater_data:/data` with an existing
absolute NAS folder, for example `/share/Backups/Shoot-It:/data`. Choose your
actual share path and grant write access. Keep it outside all live app/database
mounts. When changing this path later, copy **all existing updater data**, including
the transaction journal; do not start with empty state after a failed update.
Backups and container snapshots contain credentials/user data: restrict access,
retain an independent copy, and monitor capacity. Nothing is automatically pruned.

## What the container does

1. Checks the selected containers and detects the installed version. Downloads the
   immutable app image named in the latest stable GitHub release manifest and
   verifies its packaged version before stopping the app.
2. Disables the old app's restart policy, stops it, and saves `database.dump`,
   `uploads.tar`, `containers.json` (environment, ports, mounts, restart settings,
   networks), and release metadata under `/data/backup-…`. Verifies both archives.
3. Runs the target image's bundled migration tool. If there is no migration
   history, it adds the repeatable **1.11 schema changes**, checks the entire schema
   against the frozen 1.11 baseline, records it and deploys subsequent migrations.
   Existing 1.11 settings/users are preserved. Already migrated databases skip
   the legacy SQL. It does not need to start an old 1.11 application image.
4. Replaces only the app, preserving its environment, ports, mounted volumes,
   resource limits, restart policy and network aliases. Startup/healthcheck come
   from the new image. It requires healthy readiness with the expected version.
5. Removes only the superseded app container after success, retaining its image,
   volumes and backed-up configuration. This avoids duplicate Compose service
   labels interfering with later manual updates.

**The database container, PostgreSQL version and its mounts are never replaced.**
This includes old PostgreSQL 18 installations whose real data is in an anonymous
parent volume. The updater backs up that live database. Repairing that old storage
declaration before a future database recreation remains a separate operation;
do not recreate the DB, delete volumes or use volume prune during the transition.

## Automatic updates or manual updates

- **Automatic:** after a successful first run, set `command: ["watch"]` and
  `restart: unless-stopped` in the updater application. It checks every 15 minutes
  during `UPDATE_WINDOW` (`3-5` by default) in `TZ` (`Europe/Berlin`). `0-0` allows
  all hours. It installs only newer compatible stable releases with a supported
  manifest; missing manifests, pre-releases and major upgrades are not installed.
- **Disable:** stop the updater application. Keep `stop_grace_period: 3h` so a
  running backup/migration can finish on a graceful stop; do not force-kill it.
  Disable its restart policy or change back to `command: ["run"]`, `restart: "no"`.
  Keep the state/backup volume.
- **Manual:** leave the updater stopped, or start it with `run` whenever you want
  a checked, backed-up update. The original `docker compose pull app` / app-only
  recreation workflow also remains available after the transition.

The Docker-only updater does **not** edit Container Station's stored application
YAML, Compose files or `.env`. If those pin an old tag/digest, change the app image
there to the successfully installed version/digest (shown as `targetImage` in the
journal), or to `ghcr.io/drunkenbutgreat/shoot-it:latest`, before any later manual
app recreation. Otherwise the old declaration can reinstall an older image.
Use app-only recreation; do not redeploy the entire old database application.
The updater itself does not replace itself. Pull/recreate its container when a
future release requires a newer updater protocol.

Public GitHub releases/GHCR images need no login. A private repository requires
read access through `GITHUB_TOKEN` on the updater; private images also require a
Docker registry configuration mounted read-only at `/root/.docker/config.json`.
Host credential-helper configurations are not portable into this container.

## If a run stops with an error

- Before migration: download/check errors leave the app as it was. Backup errors
  restore its original restart policy/running state; no schema change has run.
- Migration error or interruption: the app remains stopped with restart disabled,
  and retries are blocked by `/data/transaction.json` and `<app>-update-lock`.
  A migration container may still be running after a timeout. Inspect it in
  Container Station before any recovery; do not run a second migration in parallel.
- Readiness failure from an already migrated 1.12+ installation: the exact old
  container is reconnected/restarted if the release declares compatible rollback.
  That target release is blocked until a newer version is available.
- First legacy transition: no automatic restart of the old image after a schema
  change. Old images used `db push`, which could conflict with the new schema.
  The stopped old/new containers and backup remain available for recovery.

For manual recovery, first stop scheduled checks and inspect `transaction.json`,
`containers.json`, the migration container and the app logs. Finish/resolve the
specific failed migration, then start the target app and verify `/api/ready`, or
restore the **matching database dump and uploads together** with the recorded old
container settings. Do not blindly reset the database or rerun `db push`. After
the chosen version is verified, archive the failed transaction journal and remove
only that installation's `<app>-update-lock` and stopped migration container to
allow future runs. Keep the backup. Recovery is deliberately not automatic after
an uncertain migration.

The automated tests exercise real Docker containers and PostgreSQL with synthetic
data; they do not certify a particular QNAP firmware or Container Station version.
Container Station supports application creation from Compose YAML:
[QNAP's official instructions](https://www.qnap.com/en-us/how-to/tutorial/article/how-to-use-container-station-3).
