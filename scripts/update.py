#!/usr/bin/env python3
"""Opt-in Compose updater. Python 3.9+ stdlib; run on the Docker host."""
import argparse
import datetime as dt
import fcntl
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile
import urllib.error
import urllib.request
from urllib.parse import urlsplit, unquote

REPO = 'DrunkenButGreat/Shoot-It'
IMAGE = 'ghcr.io/drunkenbutgreat/shoot-it'
API = f'https://api.github.com/repos/{REPO}'
PROTOCOL = 1


def version(value):
    if not isinstance(value, str) or not re.fullmatch(r'(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)', value):
        raise ValueError('Expected a stable major.minor.patch version')
    return tuple(map(int, value.split('.')))


def eligible(manifest, current, tag):
    target = version(manifest['version'])
    installed = version(current)
    minimum = version(manifest['minVersion'])
    if manifest.get('protocol') != PROTOCOL or tag != f"v{manifest['version']}":
        raise ValueError('Release version or updater protocol mismatch')
    if not re.fullmatch(re.escape(IMAGE) + r'@sha256:[a-f0-9]{64}', manifest.get('image', '')):
        raise ValueError('Expected an immutable Shoot-It image digest')
    if minimum > target:
        raise ValueError('Invalid minimum version')
    return (manifest.get('rollbackSafe') is True and installed >= minimum
            and target > installed and target[0] == installed[0])


class SafeRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        if not newurl.startswith('https://'):
            raise ValueError('Refusing an insecure download redirect')
        redirected = super().redirect_request(req, fp, code, msg, headers, newurl)
        # GitHub redirects asset downloads to storage; never forward credentials.
        redirected.remove_header('Authorization')
        return redirected


def fetch(url, asset=False):
    headers = {'Accept': 'application/octet-stream' if asset else 'application/vnd.github+json',
               'User-Agent': 'Shoot-It-Updater/1'}
    token = os.environ.get('GITHUB_TOKEN')
    if token:
        headers['Authorization'] = f'Bearer {token}'
    with urllib.request.build_opener(SafeRedirect()).open(urllib.request.Request(url, headers=headers), timeout=30) as response:
        data = response.read(1024 * 1024 + 1)
        if len(data) > 1024 * 1024:
            raise ValueError('Release metadata is too large')
        return json.loads(data)


def run(args, *, stdout=None, stdin=None, timeout=300, env=None):
    result = subprocess.run(args, stdout=stdout or subprocess.PIPE, stdin=stdin,
                            stderr=subprocess.PIPE, timeout=timeout, text=stdout is None, env=env)
    if result.returncode:
        # Compose diagnostics can contain secrets; keep them out of the journal.
        raise RuntimeError(f'{args[0]} {args[1]} failed (exit {result.returncode})')
    return result.stdout.strip() if stdout is None else None


def latest_manifest():
    try:
        release = fetch(f'{API}/releases/latest')
    except urllib.error.HTTPError as error:
        if error.code == 404:
            print('No visible release. For a private repository, configure GITHUB_TOKEN.')
            return None
        raise
    if release.get('draft') or release.get('prerelease'):
        return None
    assets = [a for a in release.get('assets', []) if a['name'] == 'shoot-it-update.json' and a.get('state') == 'uploaded']
    if len(assets) != 1:
        print('Release is not ready for automatic updates (manifest missing).')
        return None
    asset_id = assets[0]['id']
    if type(asset_id) is not int or asset_id <= 0:
        raise ValueError('Invalid release asset')
    manifest = fetch(f'{API}/releases/assets/{asset_id}', asset=True)
    # Validate the contract even when no update is needed.
    eligible(manifest, manifest['minVersion'], release['tag_name'])
    return manifest


def disk_space(path):
    # A requirements check must also work before the backup directory is created.
    path = Path(path)
    while not path.exists():
        path = path.parent
    return shutil.disk_usage(path).free


def atomic(path, content, mode=0o600):
    path = Path(path)
    metadata = path.stat() if path.exists() else None
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=path.parent,
                                         prefix=path.name + '.', delete=False) as file:
            temporary = Path(file.name)
            os.chmod(temporary, mode)
            if metadata:
                os.chown(temporary, metadata.st_uid, metadata.st_gid)
            file.write(content)
            file.flush()
            os.fsync(file.fileno())
        os.replace(temporary, path)
    finally:
        if temporary and temporary.exists():
            temporary.unlink()
    descriptor = os.open(path.parent, os.O_RDONLY)
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


class Updater:
    def __init__(self, config):
        self.project = Path(config['projectDirectory']).resolve()
        self.state = Path(config['stateDirectory']).resolve()
        self.backups = Path(config['backupDirectory']).resolve()
        self.env_file = self.project / '.env'
        self.window = config.get('windowHours', [3, 5])
        if len(self.window) != 2 or any(type(hour) is not int or not 0 <= hour <= 23 for hour in self.window):
            raise ValueError('windowHours must contain two hours from 0 to 23')
        self.command = ['docker', 'compose', '--project-directory', str(self.project), '--env-file', str(self.env_file)]
        for file in config['composeFiles']:
            self.command += ['-f', str(self.project / file)]
        # The managed .env is authoritative, including for manual Compose commands.
        os.environ.pop('SHOOT_IT_IMAGE', None)
        self.journal_path = self.state / 'transaction.json'

    def compose(self, *args, **kwargs):
        return run(self.command + list(args), **kwargs)

    def inspect(self, container):
        return json.loads(run(['docker', 'inspect', container]))[0]

    def containers(self):
        app_ids = self.compose('ps', '-q', 'app').splitlines()
        db_ids = self.compose('ps', '-q', 'db').splitlines()
        if len(app_ids) != 1 or len(db_ids) != 1:
            raise RuntimeError('Exactly one running app and database are required')
        return app_ids[0], db_ids[0]

    def current(self, app):
        result = json.loads(run(['docker', 'exec', app, 'node', '-e',
            "fetch('http://127.0.0.1:3000/api/ready',{signal:AbortSignal.timeout(5000)}).then(async r=>{if(!r.ok)throw Error();console.log(JSON.stringify(await r.json()))}).catch(()=>process.exit(1))"]))
        if result.get('status') != 'ok' or version(result['version']) < (1, 12, 0):
            raise RuntimeError('Install and baseline version 1.12.0 or later first')
        return result['version']

    def check_storage(self, app, db):
        config = json.loads(self.compose('config', '--format', 'json'))
        # Refuse a config that recreates a different project or discards the pin.
        for service, container in [('app', app), ('db', db)]:
            expected_project = config['name']
            if self.inspect(container)['Config']['Labels'].get('com.docker.compose.project') != expected_project:
                raise RuntimeError('Compose project mismatch')
        db_path = self.compose('exec', '-T', 'db', 'sh', '-c',
            'exec psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "SHOW data_directory"')
        volumes = config.get('volumes', {})

        def persistent(service, container, path):
            declared = config['services'][service].get('volumes', [])
            return any(
                (path == mount['Destination'] or path.startswith(mount['Destination'].rstrip('/') + '/'))
                and any(entry['target'] == mount['Destination'] and (
                    (entry['type'] == 'volume' and mount['Type'] == 'volume'
                     and mount['Name'] == volumes.get(entry['source'], {}).get('name'))
                    or (entry['type'] == 'bind' and mount['Type'] == 'bind' and entry['source'] == mount['Source'])
                ) for entry in declared)
                for mount in self.inspect(container)['Mounts'])

        if not persistent('db', db, db_path):
            raise RuntimeError('Database data is outside the declared persistent mount. Follow deploy/UPDATES.md before enabling updates.')
        if not persistent('app', app, '/app/uploads'):
            raise RuntimeError('Uploads must match the declared persistent mount')
        app_env = dict(item.split('=', 1) for item in self.inspect(app)['Config']['Env'])
        db_env = dict(item.split('=', 1) for item in self.inspect(db)['Config']['Env'])
        database = urlsplit(app_env.get('DATABASE_URL', ''))
        if (database.hostname != 'db' or database.port not in (None, 5432)
                or unquote(database.path[1:]) != db_env.get('POSTGRES_DB')
                or unquote(database.username or '') != db_env.get('POSTGRES_USER', 'postgres')
                or app_env.get('DATABASE_URL') != config['services']['app']['environment'].get('DATABASE_URL')):
            raise RuntimeError('Running app, backup database and Compose DATABASE_URL must agree')

    def pin(self, image):
        if not re.fullmatch(r'(sha256:[a-f0-9]{64}|' + re.escape(IMAGE) + r'@sha256:[a-f0-9]{64})', image):
            raise ValueError('Invalid image pin')
        if self.env_file.is_symlink():
            raise ValueError('Managed .env must not be a symlink')
        self.check_image_override()
        content = self.env_file.read_text()
        pattern = r'^\s*(?:export\s+)?SHOOT_IT_IMAGE\s*=.*$'
        content = re.sub(pattern, '', content, flags=re.MULTILINE)
        atomic(self.env_file, content.rstrip() + f'\nSHOOT_IT_IMAGE={image}\n', self.env_file.stat().st_mode & 0o777)
        actual = json.loads(self.compose('config', '--format', 'json'))['services']['app']['image']
        if actual != image:
            raise RuntimeError('Compose app.image must use ${SHOOT_IT_IMAGE:-...}; an override ignores the managed pin')

    def check_image_override(self):
        probe = IMAGE + '@sha256:' + '0' * 64
        config = json.loads(self.compose('config', '--format', 'json', env={**os.environ, 'SHOOT_IT_IMAGE': probe}))
        if config['services']['app']['image'] != probe:
            raise RuntimeError('Compose app.image must support SHOOT_IT_IMAGE; check your Compose overrides')

    def transaction(self):
        transaction = json.loads(self.journal_path.read_text()) if self.journal_path.exists() else {}
        if transaction and transaction['phase'] not in ('complete', 'rolled-back', 'backup-failed'):
            raise RuntimeError('Unfinished update requires manual recovery; see transaction.json')
        return transaction

    def journal(self, transaction, phase):
        transaction['phase'] = phase
        atomic(self.journal_path, json.dumps(transaction, indent=2) + '\n')

    def start(self, image):
        self.pin(image)
        self.compose('up', '-d', '--no-deps', '--pull', 'never', '--wait', '--wait-timeout', '120', 'app', timeout=180)

    def preflight(self, app, db):
        self.check_storage(app, db)
        uploads_kb = int(run(['docker', 'exec', app, 'du', '-sk', '/app/uploads']).split()[0])
        db_bytes = int(self.compose('exec', '-T', 'db', 'sh', '-c',
            'exec psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "SELECT pg_database_size(current_database())"'))
        # Uncompressed archives; allow dump/index overhead and one GiB headroom.
        needed = 2 * (uploads_kb * 1024 + db_bytes) + 1024 ** 3
        if disk_space(self.backups) < needed:
            raise RuntimeError('Insufficient backup space; retain or move old backups before retrying')
        docker_root = run(['docker', 'info', '--format', '{{.DockerRootDir}}'])
        if not Path(docker_root).is_dir() or shutil.disk_usage(docker_root).free < 2 * 1024 ** 3:
            raise RuntimeError('A local Linux Docker engine with at least 2 GiB free is required')

    def backup(self, app, previous, directory):
        with open(directory / 'database.dump', 'wb') as file:
            self.compose('exec', '-T', 'db', 'sh', '-c',
                'exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc', stdout=file, timeout=3600)
            os.fsync(file.fileno())
        with open(directory / 'database.dump', 'rb') as file:
            self.compose('exec', '-T', 'db', 'pg_restore', '--list', stdin=file)
        with open(directory / 'uploads.tar', 'wb') as file:
            run(['docker', 'run', '--rm', '--network', 'none', '--read-only', '--user', '0',
                 '--volumes-from', f'{app}:ro', '--entrypoint', 'tar', previous,
                 '-C', '/app/uploads', '-cf', '-', '.'], stdout=file, timeout=3600)
            os.fsync(file.fileno())
        with tarfile.open(directory / 'uploads.tar', 'r:') as archive:
            for _ in archive:
                pass
        if not (directory / 'database.dump').stat().st_size:
            raise RuntimeError('Empty database backup')
        atomic(directory / 'COMPLETE', 'Database and uploads archived while app was stopped.\n')

    def apply(self, manifest, current, app, db):
        self.preflight(app, db)
        target = manifest['image']
        print(f"Preparing {current} -> {manifest['version']}", flush=True)
        run(['docker', 'pull', target], timeout=1800)
        packaged = run(['docker', 'run', '--rm', '--network', 'none', '--read-only', '--entrypoint', 'node',
                        target, '-p', "require('./package.json').version"])
        if packaged != manifest['version']:
            raise RuntimeError('Image version does not match the release')
        previous = self.inspect(app)['Image']  # exact local ID, unaffected by mutable tags
        self.pin(previous)  # verify pin support before stopping anything
        directory = self.backups / (dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%SZ') + '-' + manifest['version'])
        directory.mkdir(mode=0o700)
        history = json.loads(self.journal_path.read_text()) if self.journal_path.exists() else {}
        transaction = {'blockedVersions': history.get('blockedVersions', []), 'fromVersion': current, 'toVersion': manifest['version'], 'previousImage': previous,
                       'targetImage': target, 'backup': str(directory)}
        atomic(directory / 'release.json', json.dumps(manifest, indent=2) + '\n')
        atomic(directory / 'previous.env', self.env_file.read_text())
        self.journal(transaction, 'stopping')
        try:
            self.compose('stop', '-t', '60', 'app', timeout=90)
            if self.inspect(app)['State']['Running']:
                raise RuntimeError('App did not stop')
            self.journal(transaction, 'backup')
            self.backup(app, previous, directory)
        except Exception:
            # No migration has run. It is safe to restart the exact old image.
            self.start(previous)
            self.journal(transaction, 'backup-failed')
            raise
        self.journal(transaction, 'migrating')
        try:
            self.pin(target)
            self.compose('run', '--rm', '--no-deps', '-T', '--name', 'shoot-it-update-migration',
                         'app', 'node', 'scripts/migrate.cjs', 'deploy', timeout=1800)
        except Exception:
            self.journal(transaction, 'migration-failed')
            raise RuntimeError('Migration failed or timed out. App remains stopped; manual recovery required (see transaction.json).') from None
        self.journal(transaction, 'starting')
        try:
            self.start(target)
            new_app, _ = self.containers()
            if self.current(new_app) != manifest['version']:
                raise RuntimeError('Unexpected running version')
        except Exception:
            transaction['blockedVersions'].append(manifest['version'])
            self.journal(transaction, 'rolling-back')
            self.start(previous)
            old_app, _ = self.containers()
            if self.current(old_app) != current:
                raise RuntimeError('Rollback readiness check failed; manual recovery required')
            self.journal(transaction, 'rolled-back')
            raise RuntimeError('Readiness failed. Previous image restored; this release is blocked.') from None
        self.journal(transaction, 'complete')
        print(f"Updated to {manifest['version']}; backup: {directory}", flush=True)

    def execute(self, mode):
        self.state.mkdir(parents=True, exist_ok=True, mode=0o700)
        self.backups.mkdir(parents=True, exist_ok=True, mode=0o700)
        with open(self.state / 'lock', 'a') as lock:
            try:
                fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError:
                print('Another updater is running; skipping.')
                return
            transaction = self.transaction()
            app, db = self.containers()
            current = self.current(app)
            if mode == 'init':
                self.check_storage(app, db)
                self.pin(self.inspect(app)['Image'])
                print(f'Installation verified and pinned at {current}.')
                return
            manifest = latest_manifest()
            if manifest is None:
                return
            if not eligible(manifest, current, 'v' + manifest['version']):
                print('No newer compatible automatic update.')
                return
            if manifest['version'] in transaction.get('blockedVersions', []):
                print('Release blocked after rollback; waiting for a new version.')
                return
            if mode == 'check':
                print(f"Available: {current} -> {manifest['version']}; image {manifest['image']}")
                return
            start, end = self.window
            hour = dt.datetime.now().hour
            inside = (start <= hour < end) if start < end else (hour >= start or hour < end)
            if start != end and not inside:
                print('Update available; waiting for the configured maintenance window.')
                return
            self.apply(manifest, current, app, db)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('mode', choices=['init', 'check', 'run'])
    parser.add_argument('--config', default='/etc/shoot-it-updater.json')
    args = parser.parse_args()
    os.umask(0o077)
    with open(args.config) as file:
        Updater(json.load(file)).execute(args.mode)


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(f'Update stopped: {error}', file=sys.stderr)
        sys.exit(1)
