#!/usr/bin/env python3
"""Integration: run the real updater container on disposable legacy installations."""
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import time
import uuid


def run(*args, success=True, **kwargs):
    result = subprocess.run(args, capture_output=True, text=True, **kwargs)
    if success and result.returncode:
        raise RuntimeError(f'{args[:3]}: {result.stdout}\n{result.stderr}')
    if not success:
        assert result.returncode != 0, result.stdout
    return result.stdout.strip()


def main(app_image, updater_image):
    name = 'shootit-container-test-' + uuid.uuid4().hex[:10]
    containers, volumes, images = [], [], []
    with tempfile.TemporaryDirectory(prefix='shootit-container-') as temporary:
        root = Path(temporary)
        def derived(extra):
            (root / 'Dockerfile').write_text(f'FROM {app_image}\n{extra}\n')
            image = run('docker', 'build', '-q', str(root)).splitlines()[-1]
            images.append(image)
            return image
        def info(container):
            return json.loads(run('docker', 'inspect', container))[0]
        def sql(query):
            return run('docker', 'exec', name + '-db', 'psql', '-U', 'postgres', '-d', 'shootit_container_test', '-Atc', query)
        def update(mode='run', target=None, success=True):
            target = target or app_image
            # Only release lookup/pull are substituted, for a locally built image
            # without a registry digest. All container, SQL, backup, replacement,
            # restart and readiness operations execute inside the actual image.
            harness = '''
import importlib.util, os, sys
sys.path.insert(0, '/updater')
spec = importlib.util.spec_from_file_location('container_update', '/updater/container-update.py')
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
target, mode = sys.argv[1:]
packaged = m.run(['docker','run','--rm','--network','none','--entrypoint','node',target,'-p','require("./package.json").version'])
digest = 'ghcr.io/drunkenbutgreat/shoot-it@sha256:' + 'a' * 64
m.latest_manifest = lambda: dict(protocol=1, containerProtocol=1, minVersion='1.12.0', legacyMinVersion='1.10.0', databaseMigrationMinVersion='1.8.0', version=packaged, rollbackSafe=True, image=digest)
original_run, original_api = m.run, m.api
def local_run(args, **kwargs):
    if args[:2] == ['docker', 'pull']: return ''
    return original_run([target if a == digest else a for a in args], **kwargs)
def local_api(method, path, body=None):
    if body and body.get('Image') == digest: body = dict(body, Image=target)
    return original_api(method, path, body)
m.run, m.api = local_run, local_api
sys.argv = ['container-update.py', mode]
m.main()
'''
            output = run('docker', 'run', '--rm', '--network', 'none', '-v', '/var/run/docker.sock:/var/run/docker.sock',
                         '-v', name + '-state:/data', '-e', 'APP_CONTAINER=' + name + '-app', '-e', 'DB_CONTAINER=' + name + '-db',
                         '--entrypoint', 'python3', updater_image, '-c', harness, target, mode, success=success)
            print(output)
            return output
        def state():
            return json.loads(run('docker', 'run', '--rm', '-v', name + '-state:/data', '--entrypoint', 'cat',
                                  updater_image, '/data/transaction.json'))
        try:
            run('docker', 'network', 'create', '--internal', name)
            run('docker', 'network', 'create', '--internal', name + '-extra')
            for suffix in ['uploads', 'state']:
                volumes.append(run('docker', 'volume', 'create', name + '-' + suffix))
            # Legacy PG18 installations can have live data in an anonymous parent
            # mount. The updater must keep this exact container/volume. New PG18
            # entrypoints reject an additional empty obsolete /data mount, so do
            # not recreate that invalid declaration in the test setup.
            containers.append(name + '-db')
            run('docker', 'run', '-d', '--name', name + '-db', '--network', name, '--network-alias', 'db',
                '-e', 'POSTGRES_PASSWORD=synthetic-only',
                '-e', 'POSTGRES_DB=shootit_container_test', 'postgres:18-alpine')
            for _ in range(60):
                if subprocess.run(['docker', 'exec', name + '-db', 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres'], capture_output=True).returncode == 0:
                    break
                time.sleep(1)
            else:
                raise RuntimeError('Test PostgreSQL did not start: ' + run('docker', 'logs', name + '-db'))
            address = 'postgresql://postgres:synthetic-only@db:5432/shootit_container_test'
            run('docker', 'run', '--rm', '--network', name, '-e', 'DATABASE_URL=' + address,
                '--entrypoint', 'node', app_image, 'scripts/migrate.cjs', 'deploy')
            sql('INSERT INTO "User" (id,email,"updatedAt") VALUES (\'preserve\',\'preserved@example.test\',NOW());')
            sql('DROP TABLE "_prisma_migrations"; DROP TABLE "RegistrationInvite"; DROP TABLE "RegistrationSettings"; '
                'DROP TABLE "ProjectVisit", "SiteSettings"; DROP TYPE "RegistrationMode"; ALTER TABLE "User" DROP COLUMN "isAdmin", DROP COLUMN "isOwner";')
            legacy = derived('USER root\nRUN node -e "let p=require(\'./package.json\');p.version=\'1.10.1\';require(\'fs\').writeFileSync(\'package.json\',JSON.stringify(p))"\n'
                             'USER nextjs\nHEALTHCHECK NONE\nCMD ["node", "-e", "setInterval(()=>{},1000)"]')
            containers.append(name + '-app')
            run('docker', 'run', '-d', '--name', name + '-app', '--restart', 'unless-stopped', '--network', name,
                '--label', 'com.docker.compose.project=' + name, '--label', 'com.docker.compose.service=app',
                '--label', 'com.docker.compose.container-number=1', '--label', 'com.docker.compose.config-hash=legacy',
                '--network-alias', 'app', '-p', '127.0.0.1::3000', '--memory', '1g', '-v', name + '-uploads:/app/uploads',
                '-e', 'DATABASE_URL=' + address, '-e', 'AUTH_SECRET=synthetic-only secret $ with spaces',
                '-e', 'AUTH_URL=http://localhost:3000', legacy)
            run('docker', 'network', 'connect', '--alias', 'photos', name + '-extra', name + '-app')
            run('docker', 'exec', name + '-app', 'sh', '-c', 'echo preserved > /app/uploads/preserved.txt')
            old_app, old_db = info(name + '-app'), info(name + '-db')
            # Migration-only mode also accepts a 1.8 image, backs up no uploads and
            # leaves the exact app container/image stopped for a manual upgrade.
            # Derive only the package version; schema fidelity is covered below
            # by dropping every additive 1.9 field, as in the historical 1.8 schema.
            run('docker', 'stop', name + '-app')
            old_package = {'name': 'photoshoot-organizer', 'version': '1.8.2'}
            (root / 'package.json').write_text(json.dumps(old_package))
            older = derived('COPY package.json /app/package.json\nHEALTHCHECK NONE\nCMD ["node", "-e", "setInterval(()=>{},1000)"]')
            run('docker', 'rm', name + '-app')
            run('docker', 'run', '-d', '--name', name + '-app', '--restart', 'unless-stopped', '--network', name,
                '-v', name + '-uploads:/app/uploads', '-e', 'DATABASE_URL=' + address, older)
            migration_app = info(name + '-app')
            for table, fields in [('User', ['brandingColor', 'brandingImage']),
                ('Project', ['brandingColor', 'brandingImage', 'allowSelectionDownload', 'showSelectionFolders']),
                ('MoodboardImage', ['isVideo', 'duration']), ('ResultFile', ['isVideo', 'duration'])]:
                for field in fields:
                    sql(f'ALTER TABLE "{table}" DROP COLUMN "{field}"')
            update('migrate')
            migration_state = state()
            assert migration_state['phase'] == 'migrated'
            assert migration_state['backupScope'] == 'database'
            assert info(name + '-app')['Id'] == migration_app['Id']
            assert info(name + '-app')['Image'] == migration_app['Image']
            assert not info(name + '-app')['State']['Running']
            assert info(name + '-app')['HostConfig']['RestartPolicy']['Name'] == 'no'
            assert info(name + '-db')['Id'] == old_db['Id']
            assert 'uploads.tar' not in run('docker', 'run', '--rm', '-v', name + '-state:/data', '--entrypoint', 'ls',
                                          updater_image, migration_state['backup'])
            assert sql('SELECT email FROM "User"') == 'preserved@example.test'
            assert sql('SELECT "isAdmin" AND "isOwner" FROM "User"') == 't'
            update('migrate') # repeatable without starting/replacing the old app
            assert info(name + '-app')['Id'] == migration_app['Id']
            # Return to the original legacy fixture to test the full update path.
            run('docker', 'rm', name + '-app')
            sql('DROP TABLE "_prisma_migrations"; DROP TABLE "RegistrationInvite"; DROP TABLE "RegistrationSettings"; '
                'DROP TABLE "ProjectVisit", "SiteSettings"; DROP TYPE "RegistrationMode"; ALTER TABLE "User" DROP COLUMN "isAdmin", DROP COLUMN "isOwner";')
            run('docker', 'run', '-d', '--name', name + '-app', '--restart', 'unless-stopped', '--network', name,
                '--label', 'com.docker.compose.project=' + name, '--label', 'com.docker.compose.service=app',
                '--label', 'com.docker.compose.container-number=1', '--label', 'com.docker.compose.config-hash=legacy',
                '--network-alias', 'app', '-p', '127.0.0.1::3000', '--memory', '1g', '-v', name + '-uploads:/app/uploads',
                '-e', 'DATABASE_URL=' + address, '-e', 'AUTH_SECRET=synthetic-only secret $ with spaces',
                '-e', 'AUTH_URL=http://localhost:3000', legacy)
            run('docker', 'network', 'connect', '--alias', 'photos', name + '-extra', name + '-app')
            old_app = info(name + '-app')
            update('check')
            assert info(name + '-app')['Id'] == old_app['Id']
            assert sql('SELECT COUNT(*) FROM "User"') == '1'
            update()
            journal = state()
            assert journal['phase'] == 'complete', journal
            new_app = info(name + '-app')
            assert new_app['Id'] != old_app['Id']
            assert new_app['HostConfig']['PortBindings'] == old_app['HostConfig']['PortBindings']
            assert new_app['HostConfig']['Memory'] == old_app['HostConfig']['Memory']
            assert new_app['HostConfig']['RestartPolicy'] == old_app['HostConfig']['RestartPolicy']
            assert set(new_app['NetworkSettings']['Networks']) == {name, name + '-extra'}
            assert 'photos' in new_app['NetworkSettings']['Networks'][name + '-extra']['Aliases']
            assert info(name + '-db')['Id'] == old_db['Id']
            assert info(name + '-db')['Mounts'] == old_db['Mounts']
            assert sql('SELECT email FROM "User"') == 'preserved@example.test'
            assert sql('SELECT "isAdmin" AND "isOwner" FROM "User"') == 't'
            assert sql('SELECT mode FROM "RegistrationSettings"') == 'OPEN'
            assert run('docker', 'exec', name + '-app', 'cat', '/app/uploads/preserved.txt') == 'preserved'
            # Verify backup restore (the backed-up legacy schema has no isAdmin).
            run('docker', 'exec', name + '-db', 'createdb', '-U', 'postgres', 'shootit_restore_test')
            dump = subprocess.run(['docker', 'run', '--rm', '-v', name + '-state:/data', '--entrypoint', 'cat',
                                   updater_image, journal['backup'] + '/database.dump'], capture_output=True, check=True).stdout
            subprocess.run(['docker', 'exec', '-i', name + '-db', 'pg_restore', '-U', 'postgres', '-d',
                            'shootit_restore_test', '--exit-on-error'], input=dump, check=True, capture_output=True)
            assert run('docker', 'exec', name + '-db', 'psql', '-U', 'postgres', '-d', 'shootit_restore_test', '-Atc',
                       'SELECT email FROM "User"') == 'preserved@example.test'
            update() # already current: no replacement or duplicate backup
            assert info(name + '-app')['Id'] == new_app['Id']
            assert state() == journal
            assert run('docker', 'run', '--rm', '-v', name + '-state:/data', '--entrypoint', 'tar', updater_image,
                       '-xOf', journal['backup'] + '/uploads.tar', './preserved.txt') == 'preserved'
            # A failed manual upgrade can already have the latest image, but still
            # lack a baseline. Repair without requiring another release.
            run('docker', 'stop', name + '-app')
            sql('DROP TABLE "ProjectVisit", "SiteSettings"; DROP TABLE "_prisma_migrations"; ALTER TABLE "User" DROP COLUMN "isOwner"; UPDATE "RegistrationSettings" SET mode=\'CLOSED\'; UPDATE "User" SET "isAdmin"=true;')
            update()
            assert state()['phase'] == 'complete'
            assert sql('SELECT mode FROM "RegistrationSettings"') == 'CLOSED'
            assert sql('SELECT "isAdmin" FROM "User"') == 't'
            # Real manual Compose recreation after Docker-only replacement.
            config = {'name': name, 'services': {'app': {
                'image': app_image, 'container_name': name + '-app', 'restart': 'unless-stopped',
                'environment': {'DATABASE_URL': address, 'AUTH_SECRET': 'synthetic-only secret $ with spaces',
                                'AUTH_URL': 'http://localhost:3000'},
                'volumes': ['uploads:/app/uploads'], 'networks': {'main': {'aliases': ['app']}, 'extra': {'aliases': ['photos']}}}},
                'volumes': {'uploads': {'external': True, 'name': name + '-uploads'}},
                'networks': {'main': {'external': True, 'name': name}, 'extra': {'external': True, 'name': name + '-extra'}}}
            (root / 'compose.json').write_text(json.dumps(config))
            run('docker', 'compose', '-f', str(root / 'compose.json'), 'up', '-d', '--no-deps', '--wait', '--wait-timeout', '120', 'app')
            assert sql('SELECT email FROM "User"') == 'preserved@example.test'
            assert run('docker', 'exec', name + '-app', 'cat', '/app/uploads/preserved.txt') == 'preserved'
            assert info(name + '-db')['Id'] == old_db['Id']
            new_app = info(name + '-app')
            newer = 'USER root\nRUN node -e "let p=require(\'./package.json\');p.version=\'1.99.0\';require(\'fs\').writeFileSync(\'package.json\',JSON.stringify(p))"\nUSER nextjs\n'
            unhealthy = derived(newer + 'HEALTHCHECK --interval=1s --timeout=1s --start-period=0s --retries=1 CMD exit 1')
            update(target=unhealthy, success=False)
            assert state()['phase'] == 'rolled-back'
            assert info(name + '-app')['Id'] == new_app['Id']
            assert info(name + '-app')['State']['Health']['Status'] == 'healthy'
            assert state()['blockedVersions'] == ['1.99.0']
            # A distinct future release fails during migration; retry stays blocked.
            broken = derived(newer.replace('1.99.0', '1.99.1') + 'USER root\nRUN printf "process.exit(1)\\n" > scripts/migrate.cjs\nUSER nextjs')
            update(target=broken, success=False)
            assert state()['phase'] == 'migration-failed'
            assert not info(name + '-app')['State']['Running']
            assert info(name + '-app')['HostConfig']['RestartPolicy']['Name'] == 'no'
            update(target=broken, success=False)
            assert not info(name + '-app')['State']['Running']
            print('PASS: container-only legacy bridge, backup restore, unchanged PG18 storage, ports/env/networks, idempotence, same-version repair, manual Compose, rollback and blocked migration failure.')
        finally:
            # Include retained failure containers and daemon-wide lock from this test.
            existing = run('docker', 'ps', '-aq', '--filter', 'name=' + name)
            if existing:
                run('docker', 'rm', '-f', '-v', *existing.splitlines())
            for volume in volumes:
                run('docker', 'volume', 'rm', volume)
            for network in [name + '-extra', name]:
                run('docker', 'network', 'rm', network)
            for image in images:
                run('docker', 'image', 'rm', image)


if __name__ == '__main__':
    main(*sys.argv[1:])
