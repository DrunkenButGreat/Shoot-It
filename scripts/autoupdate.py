#!/usr/bin/env python3
"""Check, enable or disable Shoot-It automatic updates on a Linux Docker host."""
import argparse
import fcntl
import json
import os
from pathlib import Path
import platform
import shutil
import sys

sys.dont_write_bytecode = True
from update import Updater, atomic, run, version

SOURCE = Path(__file__).resolve().parent.parent
CONFIG = Path('/etc/shoot-it-updater.json')
INSTALLED = Path('/usr/local/lib/shoot-it/update.py')
UNITS = Path('/etc/systemd/system')
SERVICE = 'shoot-it-updater.service'
TIMER = 'shoot-it-updater.timer'


def host_requirements():
    if platform.system() != 'Linux':
        raise RuntimeError('Automatic updates require a Linux host; manual Compose updates remain available.')
    if sys.version_info < (3, 9):
        raise RuntimeError('Python 3.9 or newer is required.')
    if os.geteuid() != 0:
        raise RuntimeError('Run with sudo, using the same account as the system updater.')
    if not shutil.which('systemctl') or not Path('/run/systemd/system').is_dir():
        raise RuntimeError('systemd must be running on this host.')
    print('[OK] Linux, Python and root/systemd access', flush=True)


def unit_property(unit, property_name):
    return run(['systemctl', 'show', unit, '--property', property_name, '--value'])


def configuration(project=None, backup=None, compose_files=None):
    if CONFIG.exists():
        config = json.loads(CONFIG.read_text())
        for supplied, key in [(project, 'projectDirectory'), (backup, 'backupDirectory')]:
            if supplied and Path(supplied).resolve() != Path(config[key]).resolve():
                raise ValueError(f'Existing {CONFIG} selects another {key}; edit the configuration deliberately first.')
        if compose_files and compose_files != config['composeFiles']:
            raise ValueError(f'Compose file selection differs from {CONFIG}; edit it deliberately first.')
        return config
    project_path = Path(project).resolve() if project else SOURCE
    files = compose_files or ['docker-compose.yml']
    if not compose_files and (project_path / 'docker-compose.override.yml').exists():
        files.append('docker-compose.override.yml')
    return {'projectDirectory': str(project_path), 'composeFiles': files,
            'stateDirectory': '/var/lib/shoot-it-updater',
            'backupDirectory': str(Path(backup).resolve()) if backup else '/var/backups/shoot-it',
            'windowHours': [3, 5]}


def writable_directory(path):
    if not path.is_absolute():
        raise ValueError(f'Use an absolute directory path: {path}')
    existing = path
    while not existing.exists():
        existing = existing.parent
    if not existing.is_dir() or not os.access(existing, os.W_OK | os.X_OK):
        raise ValueError(f'Directory is not accessible/writable: {path}')


def requirements(config):
    # All checks are read-only: no mkdir, pin, migration, image pull or unit install.
    if not shutil.which('docker'):
        raise RuntimeError('Docker CLI is missing.')
    if os.environ.get('DOCKER_HOST') or os.environ.get('DOCKER_CONTEXT'):
        raise RuntimeError('Unset DOCKER_HOST/DOCKER_CONTEXT; the system service uses the root account Docker context.')
    endpoint = run(['docker', 'context', 'inspect', '--format', '{{.Endpoints.docker.Host}}'])
    if not endpoint.startswith('unix://'):
        raise RuntimeError('A local Docker socket is required; remote contexts are not supported.')
    if run(['docker', 'info', '--format', '{{.OSType}}']) != 'linux':
        raise RuntimeError('A running Linux Docker engine is required.')
    if unit_property('docker.service', 'LoadState') != 'loaded':
        raise RuntimeError('docker.service is required by the updater unit; rootless/alternate Docker services are not supported.')
    compose_version = run(['docker', 'compose', 'version', '--short']).lstrip('v').split('-')[0]
    if version(compose_version) < (2, 20, 0):
        raise RuntimeError('Docker Compose 2.20 or newer is required.')
    if version(run(['/usr/bin/python3', '-c', 'import platform; print(platform.python_version())'])) < (3, 9, 0):
        raise RuntimeError('/usr/bin/python3 (used by systemd) must be version 3.9 or newer.')
    print('[OK] Local Docker engine, Compose and service Python', flush=True)

    for key in ['projectDirectory', 'stateDirectory', 'backupDirectory']:
        writable_directory(Path(config[key]))
    project = Path(config['projectDirectory'])
    if not project.is_dir():
        raise ValueError(f'Project directory does not exist: {project}')
    env = project / '.env'
    if env.is_symlink() or not env.is_file() or not os.access(env, os.R_OK | os.W_OK):
        raise ValueError(f'Expected a readable/writable regular .env file: {env}')
    files = config['composeFiles']
    if not isinstance(files, list) or not files:
        raise ValueError('composeFiles must contain at least one Compose file.')
    for file in files:
        path = project / file
        if not path.is_file() or not os.access(path, os.R_OK):
            raise ValueError(f'Compose file is missing or unreadable: {path}')
    for relative in ['scripts/update.py', 'deploy/shoot-it-updater.service', 'deploy/shoot-it-updater.timer']:
        if not (SOURCE / relative).is_file():
            raise ValueError(f'Installation source is missing: {SOURCE / relative}')
    for target in [CONFIG.parent, INSTALLED.parent, UNITS]:
        writable_directory(target)
    print(f'[OK] Project: {project}\n[OK] Compose files: {", ".join(files)}\n[OK] Backups: {config["backupDirectory"]}', flush=True)

    if unit_property(SERVICE, 'ActiveState') in ('active', 'activating', 'deactivating', 'reloading'):
        raise RuntimeError('An update service is running. Let it finish, then retry; do not interrupt migrations.')
    updater = Updater(config)
    # Inspect the same process lock as the updater without creating any files.
    lock_path = updater.state / 'lock'
    lock = open(lock_path, 'rb') if lock_path.exists() else None
    try:
        if lock:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        updater.transaction()
        app, db = updater.containers()
        current = updater.current(app)
        updater.compose('exec', '-T', 'app', 'node', 'node_modules/prisma/build/index.js', 'migrate', 'status')
        updater.check_image_override()
        updater.preflight(app, db)
        for mount in updater.inspect(app)['Mounts']:
            if mount['Destination'] == '/app/uploads':
                uploads = Path(mount['Source']).resolve()
                if any(path == uploads or uploads in path.parents for path in [updater.backups, updater.state]):
                    raise ValueError('Backup/state directories must be outside the live uploads directory.')
    except BlockingIOError:
        raise RuntimeError('An updater process is running; retry after it finishes.') from None
    finally:
        if lock:
            lock.close()
    print(f'[OK] Running version {current}, migration history, image pin support, database/uploads mounts and free space', flush=True)
    print('[OK] Local requirements passed. GitHub/GHCR connectivity and pull permissions are checked when fetching an update.', flush=True)
    return updater


def enable(config):
    updater = requirements(config)
    if unit_property(TIMER, 'LoadState') != 'not-found':
        run(['systemctl', 'disable', '--now', TIMER])
    updater.state.mkdir(parents=True, exist_ok=True, mode=0o700)
    updater.backups.mkdir(parents=True, exist_ok=True, mode=0o700)
    with open(updater.state / 'lock', 'a') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise RuntimeError('Timer disabled, but an update is still running. Let it finish and retry enable.') from None
        # Recheck after disabling the timer and acquiring the lock: another run
        # may have started between the read-only check and timer shutdown.
        updater.transaction()
        app, db = updater.containers()
        updater.current(app)
        updater.preflight(app, db)
        updater.pin(updater.inspect(app)['Image'])
        atomic(CONFIG, json.dumps(config, indent=2) + '\n')
        INSTALLED.parent.mkdir(parents=True, exist_ok=True, mode=0o755)
        atomic(INSTALLED, (SOURCE / 'scripts/update.py').read_text(), 0o644)
        for unit in [SERVICE, TIMER]:
            atomic(UNITS / unit, (SOURCE / 'deploy' / unit).read_text(), 0o644)
        run(['systemctl', 'daemon-reload'])
        run(['systemctl', 'enable', '--now', TIMER])
        if unit_property(TIMER, 'ActiveState') != 'active':
            raise RuntimeError('Timer did not become active; inspect systemctl status shoot-it-updater.timer.')
    print(f'Automatic updates enabled. Maintenance hours: {config.get("windowHours", [3, 5])}, host local time.')


def disable():
    # Turning the timer off must work even when Docker, paths or the DB are broken.
    if unit_property(TIMER, 'LoadState') == 'not-found':
        print('Automatic updates are not installed; nothing to disable.')
        return
    run(['systemctl', 'disable', '--now', TIMER])
    print('Automatic updates disabled. An already running update is allowed to finish.')
    print('Image pin, configuration and backups are preserved. For manual latest updates, follow deploy/UPDATES.md before removing SHOOT_IT_IMAGE from .env.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('mode', choices=['check', 'enable', 'disable'])
    parser.add_argument('--project-dir', help='Installation directory; defaults to this checkout or the existing configuration')
    parser.add_argument('--backup-dir', help='Backup directory for first-time setup')
    parser.add_argument('--compose-file', action='append', help='Compose file relative to the project; repeat for overrides')
    args = parser.parse_args()
    os.umask(0o077)
    host_requirements()
    if args.mode == 'disable':
        disable()
        return
    config = configuration(args.project_dir, args.backup_dir, args.compose_file)
    if args.mode == 'check':
        requirements(config)
    else:
        enable(config)


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(f'Autoupdate: {error}', file=sys.stderr)
        sys.exit(1)
