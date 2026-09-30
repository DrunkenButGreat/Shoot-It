#!/usr/bin/env python3
"""Real Compose transaction/rollback check; synthetic isolated volumes only."""
import json
from pathlib import Path
import sys
import tempfile
import uuid
from unittest.mock import patch
import update


def main(image):
    name = 'shootit-update-test-' + uuid.uuid4().hex[:10]
    image_ids = []
    original_run = update.run
    with tempfile.TemporaryDirectory(prefix='shootit-compose-') as directory:
        root = Path(directory)
        (root / '.env').write_text('SHOOT_IT_IMAGE=' + image + '\n')
        compose = {'name': name, 'services': {
            'db': {'image': 'postgres:18-alpine', 'environment': {'POSTGRES_USER': 'postgres',
                'POSTGRES_PASSWORD': 'synthetic-only', 'POSTGRES_DB': 'shootit_compose_test'},
                'volumes': ['db_data:/var/lib/postgresql'],
                'healthcheck': {'test': ['CMD', 'pg_isready', '-U', 'postgres'], 'interval': '1s', 'timeout': '3s', 'retries': 60}},
            'app': {'image': '${SHOOT_IT_IMAGE:-' + image + '}', 'environment': {
                'DATABASE_URL': 'postgresql://postgres:synthetic-only@db:5432/shootit_compose_test',
                'AUTH_SECRET': 'synthetic-only-secret-at-least-32-characters', 'AUTH_URL': 'http://localhost:3000'},
                'volumes': ['uploads:/app/uploads'], 'depends_on': {'db': {'condition': 'service_healthy'}}}},
            'volumes': {'db_data': {}, 'uploads': {}}, 'networks': {'default': {'internal': True}}}
        (root / 'compose.json').write_text(json.dumps(compose))
        updater = update.Updater({'projectDirectory': directory, 'stateDirectory': str(root / 'state'),
            'backupDirectory': str(root / 'backups'), 'composeFiles': ['compose.json'], 'windowHours': [0, 0]})
        updater.state.mkdir()
        updater.backups.mkdir()
        try:
            updater.compose('up', '-d', '--wait', '--wait-timeout', '120', timeout=180)
            app, db = updater.containers()
            current = updater.current(app)
            # Only the registry download and host disk location are substituted:
            # local derived images have no registry digest, and Docker Desktop's
            # Linux storage path cannot be stat'ed from macOS. All Compose,
            # storage checks, DB migration, backup and rollback calls are real.
            def local_run(args, **kwargs):
                if args[:2] == ['docker', 'pull'] and args[2] in image_ids:
                    return ''
                if args == ['docker', 'info', '--format', '{{.DockerRootDir}}']:
                    return directory
                return original_run(args, **kwargs)

            def derived(extra):
                (root / 'Dockerfile').write_text(f'FROM {image}\n{extra}\n')
                result = original_run(['docker', 'build', '-q', str(root)], timeout=120)
                image_ids.append(result.splitlines()[-1])
                return image_ids[-1]

            good = derived('LABEL io.shootit.test="healthy"')
            manual = derived('LABEL io.shootit.test="manual"')
            unhealthy = derived('HEALTHCHECK --interval=1s --timeout=1s --start-period=0s --retries=1 CMD exit 1')
            (root / 'fail.cjs').write_text('process.exit(1)\n')
            broken_migration = derived('COPY fail.cjs /app/scripts/migrate.cjs')
            # Manual Compose replacement works before installing the updater.
            original_run(['docker', 'exec', app, 'node', '-e',
                "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.user.create({data:{email:'manual@example.test'}}).finally(()=>p.$disconnect())"])
            original_run(['docker', 'exec', app, 'sh', '-c', 'echo preserved > /app/uploads/manual.txt'])
            (root / '.env').write_text('SHOOT_IT_IMAGE=' + manual + '\n')
            updater.compose('up', '-d', '--no-deps', '--wait', '--wait-timeout', '120', 'app', timeout=180)
            app, unchanged_db = updater.containers()
            assert unchanged_db == db
            assert updater.inspect(app)['Image'] == manual
            assert not updater.journal_path.exists()
            updater.execute('init')
            manifest = {'version': current, 'minVersion': current, 'protocol': 1, 'rollbackSafe': True, 'image': good}
            with patch('update.run', side_effect=local_run):
                # Version selection is checked separately; here use the same
                # package version with different local images to exercise Docker.
                updater.apply(manifest, current, app, db)
                assert json.loads(updater.journal_path.read_text())['phase'] == 'complete'
                app, db = updater.containers()
                assert updater.inspect(app)['Image'] == good
                # Switching back to manual: remove the digest pin and use the
                # Compose default image (a local tag here, latest in production).
                (root / '.env').write_text('')
                updater.compose('up', '-d', '--no-deps', '--wait', '--wait-timeout', '120', 'app', timeout=180)
                app, unchanged_db = updater.containers()
                assert unchanged_db == db
                previous = updater.inspect(app)['Image']
                assert previous != good
                original_run(['docker', 'exec', app, 'node', '-e',
                    "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.user.count({where:{email:'manual@example.test'}}).then(n=>{if(n!==1)throw Error('Lost user')}).finally(()=>p.$disconnect())"])
                assert original_run(['docker', 'exec', app, 'cat', '/app/uploads/manual.txt']) == 'preserved'
                manifest['image'] = unhealthy
                try:
                    updater.apply(manifest, current, app, db)
                    raise AssertionError('Unhealthy image was accepted')
                except RuntimeError as error:
                    assert 'Previous image restored' in str(error), str(error)
                journal = json.loads(updater.journal_path.read_text())
                assert journal['phase'] == 'rolled-back'
                assert current in journal['blockedVersions']
                app, db = updater.containers()
                assert updater.inspect(app)['Image'] == previous
                assert updater.current(app) == current
                manifest['image'] = broken_migration
                try:
                    updater.apply(manifest, current, app, db)
                    raise AssertionError('Broken migration was accepted')
                except RuntimeError as error:
                    assert 'App remains stopped' in str(error), str(error)
                assert not updater.inspect(app)['State']['Running']
                assert json.loads(updater.journal_path.read_text())['phase'] == 'migration-failed'
                try:
                    updater.execute('run')
                    raise AssertionError('Incomplete migration was retried')
                except RuntimeError as error:
                    assert 'manual recovery' in str(error), str(error)
            print('PASS: manual Compose before/after opt-in preserves data; real image replacement/pin, consistent backup, migration, readiness rollback and stopped/blocked migration failure.')
        finally:
            updater.compose('down', '--volumes', '--remove-orphans', timeout=120)
            for image_id in image_ids:
                original_run(['docker', 'image', 'rm', image_id])


if __name__ == '__main__':
    main(sys.argv[1])
