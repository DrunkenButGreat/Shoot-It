#!/usr/bin/env python3
"""Docker-only Shoot-It updater: no host Python, systemd, Compose or checkout."""
import argparse
import copy
import datetime as dt
import fcntl
import http.client
import json
import os
from pathlib import Path
import re
import shutil
import signal
import socket
import sys
import tarfile
import threading
import time
from urllib.parse import parse_qs, quote, unquote, urlsplit

from update import atomic, eligible, latest_manifest, run, version

STOP = threading.Event()
TERMINAL = ('complete', 'backup-failed', 'rolled-back')


class DockerConnection(http.client.HTTPConnection):
    def connect(self):
        self.sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        self.sock.settimeout(self.timeout)
        self.sock.connect('/var/run/docker.sock')


def api(method, path, body=None):
    # Docker CLI handles streaming operations. The stdlib handles JSON create/
    # connect calls so ports, mounts and resource limits survive without translation.
    connection = DockerConnection('localhost', timeout=120)
    try:
        connection.request(method, path, None if body is None else json.dumps(body),
                           {'Content-Type': 'application/json'})
        response = connection.getresponse()
        data = response.read()
        if response.status >= 400:
            # Engine errors may echo environment values; do not log response bodies.
            raise RuntimeError(f'Docker API {method} {path.split("?")[0]} failed (HTTP {response.status})')
        return json.loads(data) if data else None
    finally:
        connection.close()


def inspect(name):
    return json.loads(run(['docker', 'inspect', name]))[0]


def environment(config):
    return dict(item.split('=', 1) for item in config.get('Env', []))


def endpoints(container):
    result = {}
    for name, endpoint in container['NetworkSettings']['Networks'].items():
        clean = {key: endpoint[key] for key in ('IPAMConfig', 'Links', 'Aliases', 'DriverOpts') if endpoint.get(key)}
        clean['Aliases'] = [alias for alias in clean.get('Aliases', [])
                            if alias not in (container['Id'], container['Id'][:12])]
        result[name] = clean
    return result


def replacement(container, image, image_config):
    config = copy.deepcopy(container['Config'])
    config['Image'] = image
    # Never carry the legacy `db push` startup or an old healthcheck into a new image.
    for key in ('Cmd', 'Entrypoint', 'WorkingDir', 'User', 'Healthcheck'):
        config.pop(key, None)
        if key in image_config:
            config[key] = image_config[key]
    config['Env'] = [f'{key}={value}' for key, value in
                     {**environment(image_config), **environment(container['Config'])}.items()]
    if config.get('Hostname') == container['Id'][:12]:
        config.pop('Hostname')
    host = copy.deepcopy(container['HostConfig'])
    # Explicitly reuse even anonymous volumes; never let create allocate empty ones.
    declared = {item['Target'] for item in host.get('Mounts', [])}
    declared.update(item.split(':')[1] for item in host.get('Binds') or [])
    host['Binds'] = list(host.get('Binds') or [])
    for mount in container['Mounts']:
        if mount['Type'] in ('bind', 'volume') and mount['Destination'] not in declared:
            source = mount['Name'] if mount['Type'] == 'volume' else mount['Source']
            host['Binds'].append(f'{source}:{mount["Destination"]}:{"rw" if mount["RW"] else "ro"}')
    networks = endpoints(container)
    first = next(iter(networks))
    host['NetworkMode'] = first
    return {**config, 'HostConfig': host, 'NetworkingConfig': {'EndpointsConfig': {first: networks[first]}}}


def compatible(manifest, current, repair_legacy=False):
    if manifest.get('containerProtocol') != 1:
        raise ValueError('This release has no compatible container upgrade. Wait for a release with containerProtocol 1.')
    minimum = manifest['minVersion']
    if version(current) < version(minimum):
        minimum = manifest.get('legacyMinVersion', minimum)
        if version(minimum) < (1, 10, 0):
            raise ValueError('Unsupported legacy upgrade contract')
    newer = eligible({**manifest, 'minVersion': minimum}, current, 'v' + manifest['version'])
    return newer or (repair_legacy and current == manifest['version'] and manifest.get('rollbackSafe') is True)


class ContainerUpdater:
    def __init__(self):
        if os.environ.get('DOCKER_CONTEXT') or os.environ.get('DOCKER_HOST', 'unix:///var/run/docker.sock') != 'unix:///var/run/docker.sock':
            raise RuntimeError('Use the mounted local Docker socket; remote Docker contexts are not supported')
        self.app_name = os.environ.get('APP_CONTAINER', 'photoshoot-app')
        self.db_name = os.environ.get('DB_CONTAINER', 'photoshoot-db')
        for name in (self.app_name, self.db_name):
            if not re.fullmatch(r'[a-zA-Z0-9][a-zA-Z0-9_.-]*', name):
                raise ValueError('APP_CONTAINER and DB_CONTAINER must be Docker container names')
        self.data = Path('/data')
        self.journal_path = self.data / 'transaction.json'
        self.lock_name = self.app_name + '-update-lock'
        server = api('GET', '/version')
        supported = tuple(map(int, server['ApiVersion'].split('.')))
        minimum = tuple(map(int, server.get('MinAPIVersion', '1.24').split('.')))
        selected = min(supported, (1, 47))
        if server.get('Os') != 'linux' or selected < (1, 40) or selected < minimum:
            raise RuntimeError('Linux Docker Engine API 1.40–1.47 required (Docker 19.03 or newer with a compatible API)')
        self.prefix = '/v' + '.'.join(map(str, selected))

    def journal(self, transaction, phase):
        transaction['phase'] = phase
        atomic(self.journal_path, json.dumps(transaction, indent=2) + '\n')
        print(f'Update: {phase}', flush=True)

    def transaction(self):
        history = json.loads(self.journal_path.read_text()) if self.journal_path.exists() else {}
        if history and history['phase'] not in TERMINAL:
            raise RuntimeError('Unfinished update; app stays stopped. Inspect /data/transaction.json and the recovery guide.')
        return history

    def sql(self, query):
        return run(['docker', 'exec', self.db['Id'], 'psql', '-U', self.db_env.get('POSTGRES_USER', 'postgres'),
                    '-d', self.db_env['POSTGRES_DB'], '-Atc', query])

    def requirements(self):
        self.app, self.db = inspect(self.app_name), inspect(self.db_name)
        if self.app['Id'] == self.db['Id'] or not self.db['State']['Running']:
            raise RuntimeError('A separate running PostgreSQL container is required')
        self_container = inspect(os.environ.get('HOSTNAME', ''))
        data_mount = next((m for m in self_container['Mounts'] if m['Destination'] == '/data' and m['RW']
                           and m['Type'] in ('bind', 'volume')), None)
        if not data_mount:
            raise RuntimeError('Mount a persistent writable volume or NAS backup folder at /data')
        for container in (self.app, self.db):
            for mount in container['Mounts']:
                source, backup = Path(mount['Source']), Path(data_mount['Source'])
                if source == backup or source in backup.parents or backup in source.parents:
                    raise RuntimeError('Updater /data must be separate from application/database mounts')
        app_env = environment(self.app['Config'])
        self.db_env = environment(self.db['Config'])
        address = urlsplit(app_env.get('DATABASE_URL', ''))
        networks = self.app['NetworkSettings']['Networks']
        shared = set(networks) & set(self.db['NetworkSettings']['Networks'])
        aliases = {self.db_name}
        for network in shared:
            endpoint = self.db['NetworkSettings']['Networks'][network]
            aliases.update(endpoint.get('Aliases') or [])
            aliases.add(endpoint.get('IPAddress'))
        if (address.scheme not in ('postgres', 'postgresql') or address.hostname not in aliases
                or address.port not in (None, 5432)
                or unquote(address.path[1:]) != self.db_env.get('POSTGRES_DB')
                or unquote(address.username or '') != self.db_env.get('POSTGRES_USER', 'postgres')
                or not shared):
            raise RuntimeError('DATABASE_URL must refer to the selected DB on a shared Docker network')
        self.network = sorted(shared)[0]
        schema = parse_qs(address.query).get('schema', ['public'])[0]
        self.legacy = self.sql("SELECT COUNT(*) FROM pg_tables WHERE schemaname = '" + schema.replace("'", "''")
                               + "' AND tablename = '_prisma_migrations'") == '0'
        host = self.app['HostConfig']
        if host.get('AutoRemove') or host.get('VolumesFrom') or host.get('Links') or host.get('NetworkMode') in ('host', 'none'):
            raise RuntimeError('Use persistent containers on a user-defined Docker network without legacy links/volumes-from')
        for name, endpoint in networks.items():
            if inspect(name).get('Driver') != 'bridge' or name == 'bridge' or endpoint.get('IPAMConfig'):
                raise RuntimeError('Automatic replacement requires bridge networks with dynamic IP addresses')
        original = inspect(self.app['Image'])['Config']
        for key in ('Cmd', 'Entrypoint', 'User', 'WorkingDir'):
            if self.app['Config'].get(key) != original.get(key):
                raise RuntimeError(f'Custom app {key} is not supported; restore the image default first')
        package = json.loads(run(['docker', 'run', '--rm', '--network', 'none', '--read-only', '--entrypoint', 'node',
                                 self.app['Image'], '-e', 'console.log(JSON.stringify(require("./package.json")))']))
        if package.get('name') != 'photoshoot-organizer':
            raise RuntimeError('Selected application is not Shoot-It')
        self.current = package['version']
        if not (1, 10, 0) <= version(self.current) < (2, 0, 0):
            raise RuntimeError('Supported source versions: 1.10.x and later 1.x releases')
        if app_env.get('PORT', '3000') != '3000':
            raise RuntimeError('The readiness check requires app PORT=3000')
        if not any(m['Destination'] == '/app/uploads' and m['Type'] in ('bind', 'volume') and m['RW'] for m in self.app['Mounts']):
            raise RuntimeError('Persistent writable /app/uploads mount required')
        data_directory = self.sql('SHOW data_directory')
        if not any(m['Type'] in ('bind', 'volume') and (data_directory == m['Destination'] or
                   data_directory.startswith(m['Destination'].rstrip('/') + '/')) for m in self.db['Mounts']):
            raise RuntimeError('PostgreSQL data must be in a persistent mount')
        # Works from a container on NAS/Desktop: query storage through Docker,
        # rather than assuming the daemon paths exist on the updater filesystem.
        uploads = int(run(['docker', 'run', '--rm', '--network', 'none', '--read-only', '--user', '0',
                           '--volumes-from', self.app['Id'] + ':ro', '--entrypoint', 'du', self.app['Image'],
                           '-sk', '/app/uploads']).split()[0]) * 1024
        if shutil.disk_usage(self.data).free < 2 * (uploads + int(self.sql('SELECT pg_database_size(current_database())'))) + 1024**3:
            raise RuntimeError('Insufficient backup space; free space or move /data to a larger NAS folder')
        print(f'Checks passed: Shoot-It {self.current}; app={self.app_name}, database={self.db_name}; persistent backups at /data.')
        print('Database container and its existing mounts will be retained, including legacy PostgreSQL 18 mounts.')

    def backup(self, directory):
        with open(directory / 'database.dump', 'wb') as file:
            run(['docker', 'exec', self.db['Id'], 'pg_dump', '-U', self.db_env.get('POSTGRES_USER', 'postgres'),
                 '-d', self.db_env['POSTGRES_DB'], '-Fc'], stdout=file, timeout=3600)
            os.fsync(file.fileno())
        with open(directory / 'database.dump', 'rb') as file:
            run(['docker', 'exec', '-i', self.db['Id'], 'pg_restore', '--list'], stdin=file)
        with open(directory / 'uploads.tar', 'wb') as file:
            run(['docker', 'run', '--rm', '--network', 'none', '--read-only', '--user', '0',
                 '--volumes-from', self.app['Id'] + ':ro', '--entrypoint', 'tar', self.app['Image'],
                 '-C', '/app/uploads', '-cf', '-', '.'], stdout=file, timeout=3600)
            os.fsync(file.fileno())
        with tarfile.open(directory / 'uploads.tar') as archive:
            for _ in archive:
                pass
        if not (directory / 'database.dump').stat().st_size:
            raise RuntimeError('Empty database dump')
        atomic(directory / 'COMPLETE', 'Database and uploads saved with application stopped.\n')

    def wait_ready(self, name, expected):
        for _ in range(60):
            container = inspect(name)
            if container['State'].get('Health', {}).get('Status') == 'healthy':
                response = json.loads(run(['docker', 'exec', name, 'node', '-e',
                    "fetch('http://127.0.0.1:3000/api/ready',{signal:AbortSignal.timeout(5000)}).then(async r=>{if(!r.ok)throw Error();console.log(JSON.stringify(await r.json()))}).catch(()=>process.exit(1))"]))
                if response.get('status') == 'ok' and response.get('version') == expected:
                    return
            if not container['State']['Running'] or container['State'].get('Health', {}).get('Status') == 'unhealthy':
                break
            time.sleep(2)
        raise RuntimeError('New app did not become ready with the expected version')

    def connect(self, container, networks):
        for name, endpoint in networks.items():
            api('POST', self.prefix + '/networks/' + quote(name, safe='') + '/connect',
                {'Container': container, 'EndpointConfig': endpoint})

    def apply(self, manifest, history):
        target = manifest['image']
        print(f'Preparing {self.current} -> {manifest["version"]}', flush=True)
        run(['docker', 'pull', target], timeout=1800)
        packaged = run(['docker', 'run', '--rm', '--network', 'none', '--read-only', '--entrypoint', 'node',
                        target, '-p', 'require("./package.json").version'])
        if packaged != manifest['version']:
            raise RuntimeError('Release image version mismatch')
        image_config = inspect(target)['Config']
        if not image_config.get('Healthcheck') or image_config['Healthcheck']['Test'][0] == 'NONE':
            raise RuntimeError('Target image must provide a readiness healthcheck')
        payload = replacement(self.app, target, image_config)
        if STOP.is_set():
            return
        directory = self.data / ('backup-' + dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%S.%fZ'))
        directory.mkdir(mode=0o700)
        old_name = self.app_name + '-previous-' + self.app['Id'][:12]
        transaction = {'fromVersion': self.current, 'toVersion': manifest['version'], 'previousContainer': self.app['Id'],
                       'previousName': old_name, 'appName': self.app_name, 'databaseContainer': self.db['Id'],
                       'backup': str(directory), 'targetImage': target, 'blockedVersions': history.get('blockedVersions', [])}
        atomic(directory / 'containers.json', json.dumps({'app': self.app, 'db': self.db}, indent=2) + '\n')
        atomic(directory / 'release.json', json.dumps(manifest, indent=2) + '\n')
        self.journal(transaction, 'stopping')
        # Disable restart first: a NAS reboot must not restart a legacy db-push app
        # against a partially migrated database. Its original policy is in the backup.
        run(['docker', 'update', '--restart=no', self.app['Id']])
        try:
            run(['docker', 'stop', '-t', '60', self.app['Id']], timeout=90)
            if inspect(self.app['Id'])['State']['Running']:
                raise RuntimeError('Application did not stop')
            self.journal(transaction, 'backup')
            self.backup(directory)
        except Exception:
            self.restore_restart()
            if self.app['State']['Running']:
                run(['docker', 'start', self.app['Id']])
            self.journal(transaction, 'backup-failed')
            raise
        self.journal(transaction, 'migrating')
        # Env travels through the local Docker API, never command arguments/logs.
        migration = api('POST', self.prefix + '/containers/create?name=' + quote(self.app_name + '-migration'), {
            'Image': target, 'Env': self.app['Config']['Env'], 'Entrypoint': ['node'],
            'Cmd': ['scripts/migrate.cjs', 'upgrade'], 'WorkingDir': '/app',
            'HostConfig': {'NetworkMode': self.network, 'RestartPolicy': {'Name': 'no'}},
        })['Id']
        transaction['migrationContainer'] = migration
        self.journal(transaction, 'migrating')
        run(['docker', 'start', migration])
        if run(['docker', 'wait', migration], timeout=1800) != '0':
            self.journal(transaction, 'migration-failed')
            raise RuntimeError('Migration failed. App remains stopped; inspect the migration container and recovery guide.')
        run(['docker', 'rm', migration])
        self.journal(transaction, 'replacing')
        run(['docker', 'rename', self.app['Id'], old_name])
        networks = endpoints(self.app)
        for network in networks:
            run(['docker', 'network', 'disconnect', network, self.app['Id']])
        created = None
        try:
            created = api('POST', self.prefix + '/containers/create?name=' + quote(self.app_name), payload)['Id']
            transaction['newContainer'] = created
            self.journal(transaction, 'starting')
            self.connect(created, dict(list(networks.items())[1:]))
            run(['docker', 'start', created])
            self.wait_ready(created, manifest['version'])
        except Exception:
            if created:
                run(['docker', 'update', '--restart=no', created])
                run(['docker', 'stop', '-t', '60', created], timeout=90)
            # Pre-1.12 startup used db push, so never run it against the new schema.
            if self.legacy or version(self.current) < (1, 12, 0):
                self.journal(transaction, 'readiness-failed')
                raise RuntimeError('Legacy transition failed readiness. App stays stopped; backups and old container are retained.') from None
            self.journal(transaction, 'rolling-back')
            if created:
                run(['docker', 'rm', created])
            run(['docker', 'rename', self.app['Id'], self.app_name])
            self.connect(self.app['Id'], networks)
            self.restore_restart()
            run(['docker', 'start', self.app['Id']])
            self.wait_ready(self.app['Id'], self.current)
            transaction['blockedVersions'].append(manifest['version'])
            self.journal(transaction, 'rolled-back')
            raise RuntimeError('Previous application restored; failed release blocked') from None
        # Remove only the superseded container, never its volumes/image. Keeping a
        # second app with the same Compose labels confuses later manual redeploys.
        self.journal(transaction, 'cleanup')
        run(['docker', 'rm', self.app['Id']])
        self.journal(transaction, 'complete')
        print(f'Updated to {manifest["version"]}. Backup and previous container configuration: {directory}.')

    def restore_restart(self):
        policy = self.app['HostConfig']['RestartPolicy']
        value = policy['Name'] or 'no'
        if value == 'on-failure' and policy.get('MaximumRetryCount'):
            value += ':' + str(policy['MaximumRetryCount'])
        run(['docker', 'update', '--restart=' + value, self.app['Id']])

    def execute(self, mode):
        history = self.transaction()
        self.requirements()
        manifest = latest_manifest()
        if manifest is None:
            return
        if not compatible(manifest, self.current, repair_legacy=self.legacy):
            print('No newer compatible update. No changes made.')
            return
        if manifest['version'] in history.get('blockedVersions', []):
            raise RuntimeError('Release is blocked after rollback; wait for a newer release')
        print(f'Available: {self.current} -> {manifest["version"]}')
        if mode == 'check':
            return
        # Atomic daemon-wide lock also blocks two updaters with different /data mounts.
        lock = run(['docker', 'create', '--name', self.lock_name, '--network', 'none',
                    '--entrypoint', 'true', self.app['Image']])
        try:
            self.apply(manifest, history)
        finally:
            transaction = json.loads(self.journal_path.read_text()) if self.journal_path.exists() else {}
            if not transaction or transaction.get('phase') in TERMINAL:
                run(['docker', 'rm', lock])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('mode', choices=['check', 'run', 'watch'], nargs='?', default='run')
    mode = parser.parse_args().mode
    os.umask(0o077)
    signal.signal(signal.SIGTERM, lambda *_: STOP.set())
    signal.signal(signal.SIGINT, lambda *_: STOP.set())
    window = os.environ.get('UPDATE_WINDOW', '3-5').split('-')
    if len(window) != 2 or any(not hour.isdigit() or not 0 <= int(hour) <= 23 for hour in window):
        raise ValueError('UPDATE_WINDOW must contain two hours, e.g. 3-5 or 0-0')
    start, end = map(int, window)
    while not STOP.is_set():
        hour = dt.datetime.now().hour
        inside = start == end or (start <= hour < end if start < end else hour >= start or hour < end)
        try:
            if mode != 'watch' or inside:
                updater = ContainerUpdater()
                # The persistent lock protects the journal. check creates only this
                # bookkeeping file, and does not pull, stop, migrate or replace apps.
                with open(updater.data / 'lock', 'a') as lock:
                    fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
                    updater.execute('run' if mode == 'watch' else mode)
            else:
                print('Waiting for maintenance window (container TZ).')
        except Exception as error:
            if mode != 'watch':
                raise
            print(f'Update stopped: {error}', file=sys.stderr)
        if mode != 'watch':
            return
        STOP.wait(900)


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(f'Update stopped: {error}', file=sys.stderr)
        sys.exit(1)
