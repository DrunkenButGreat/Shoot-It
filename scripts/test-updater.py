#!/usr/bin/env python3
"""No Docker/network needed: exercise the production transaction and failure paths."""
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import update

OLD = 'sha256:' + 'a' * 64
TARGET = update.IMAGE + '@sha256:' + 'b' * 64
MANIFEST = {'protocol': 1, 'version': '1.14.0', 'minVersion': '1.12.0', 'rollbackSafe': True, 'image': TARGET}


class UpdateChecks(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        root = Path(self.temp.name)
        (root / '.env').write_text('DB_PASSWORD="keep-this"\nSHOOT_IT_IMAGE=old\n')
        self.updater = update.Updater({'projectDirectory': str(root), 'stateDirectory': str(root / 'state'),
                                       'backupDirectory': str(root / 'backups'), 'composeFiles': ['docker-compose.yml'], 'windowHours': [0, 0]})
        self.updater.state.mkdir()
        self.updater.backups.mkdir()
        self.events = []
        self.fail = None
        self.updater.preflight = lambda *args: self.events.append('preflight')
        self.updater.containers = lambda: ('app', 'db')
        self.updater.current = lambda app: '1.14.0' if TARGET in (root / '.env').read_text() else '1.12.0'
        self.updater.inspect = lambda _: {'Image': OLD, 'State': {'Running': False}}
        self.updater.compose = self.compose
        self.updater.backup = self.backup
        mock = patch('update.run', side_effect=self.command_run)
        mock.start()
        self.addCleanup(mock.stop)

    def compose(self, *args, **kwargs):
        self.events.append(args[0])
        if args[0] == 'config':
            env = self.updater.env_file.read_text()
            return json.dumps({'services': {'app': {'image': env.split('SHOOT_IT_IMAGE=')[1].strip()}}})
        if args[0] == 'run' and self.fail == 'migration':
            raise RuntimeError('migration error')
        if args[0] == 'up':
            self.assertIn('--no-deps', args)
            self.assertIn('--wait', args)
            if self.fail == 'readiness' and TARGET in self.updater.env_file.read_text():
                raise RuntimeError('unhealthy')
        return ''

    def command_run(self, args, **kwargs):
        self.events.append(args[1])
        if args[1] == 'pull' and self.fail == 'pull':
            raise RuntimeError('offline')
        return '1.14.0'

    def backup(self, *args):
        self.events.append('backup')
        if self.fail == 'backup':
            raise RuntimeError('disk full')

    def apply(self):
        self.updater.apply(MANIFEST, '1.12.0', 'app', 'db')

    def phase(self):
        return json.loads(self.updater.journal_path.read_text())['phase']

    def test_policy(self):
        self.assertTrue(update.eligible(MANIFEST, '1.12.0', 'v1.14.0'))
        for current in ['1.11.0', '1.14.0', '1.15.0', '2.0.0']:
            self.assertFalse(update.eligible(MANIFEST, current, 'v1.14.0'))
        self.assertFalse(update.eligible({**MANIFEST, 'rollbackSafe': False}, '1.12.0', 'v1.14.0'))
        for change in [{'version': '1.14.0-rc1'}, {'image': 'other/image:latest'}, {'protocol': 2}, {'minVersion': '1.15.0'}]:
            with self.assertRaises(ValueError):
                update.eligible({**MANIFEST, **change}, '1.12.0', 'v1.14.0')
        with self.assertRaises(ValueError):
            update.eligible(MANIFEST, '1.12.0', 'v1.13.0')
        self.assertLess(update.version('1.9.0'), update.version('1.12.0'))
        with self.assertRaises(ValueError):
            update.version('1.01.0')

    def test_success_order_and_persistent_pin(self):
        self.apply()
        self.assertEqual(self.phase(), 'complete')
        self.assertLess(self.events.index('pull'), self.events.index('stop'))
        self.assertLess(self.events.index('stop'), self.events.index('backup'))
        self.assertLess(self.events.index('backup'), self.events.index('run', self.events.index('backup')))
        self.assertIn('DB_PASSWORD="keep-this"', self.updater.env_file.read_text())
        self.assertIn(TARGET, self.updater.env_file.read_text())
        self.assertEqual(self.updater.env_file.read_text().count('SHOOT_IT_IMAGE='), 1)
        self.assertEqual(self.updater.env_file.stat().st_uid, Path(self.temp.name).stat().st_uid)

    def test_download_failure_never_stops(self):
        self.fail = 'pull'
        with self.assertRaises(RuntimeError): self.apply()
        self.assertNotIn('stop', self.events)
        self.assertFalse(self.updater.journal_path.exists())

    def test_backup_failure_restarts_without_migration(self):
        self.fail = 'backup'
        with self.assertRaises(RuntimeError): self.apply()
        self.assertEqual(self.phase(), 'backup-failed')
        self.assertNotIn('run', self.events[self.events.index('backup'):])
        self.assertIn(OLD, self.updater.env_file.read_text())

    def test_migration_failure_stays_stopped_and_blocks_followups(self):
        self.fail = 'migration'
        with self.assertRaises(RuntimeError): self.apply()
        self.assertEqual(self.phase(), 'migration-failed')
        self.assertNotIn('up', self.events)
        with self.assertRaisesRegex(RuntimeError, 'manual recovery'):
            self.updater.execute('run')

    def test_readiness_failure_restores_old_image_and_blocks_release(self):
        self.fail = 'readiness'
        with self.assertRaises(RuntimeError): self.apply()
        self.assertEqual(self.phase(), 'rolled-back')
        self.assertIn(OLD, self.updater.env_file.read_text())
        self.events.clear()
        release = {'tag_name': 'v1.14.0', 'draft': False, 'prerelease': False,
                   'assets': [{'name': 'shoot-it-update.json', 'state': 'uploaded', 'id': 1}]}
        with patch('update.fetch', side_effect=[release, MANIFEST]):
            self.updater.execute('run')
        self.assertNotIn('stop', self.events)

    def test_interrupted_transaction_never_restarts_automatically(self):
        for phase in ['stopping', 'backup', 'migrating', 'starting', 'rolling-back']:
            self.updater.journal({'phase': phase}, phase)
            with self.assertRaisesRegex(RuntimeError, 'manual recovery'):
                self.updater.execute('run')

    def test_missing_asset_and_check_mode_never_mutate_app(self):
        release = {'tag_name': 'v1.14.0', 'assets': []}
        with patch('update.fetch', return_value=release): self.updater.execute('run')
        release['assets'] = [{'name': 'shoot-it-update.json', 'state': 'uploaded', 'id': 1}]
        with patch('update.fetch', side_effect=[release, MANIFEST]): self.updater.execute('check')
        self.assertNotIn('stop', self.events)
        self.assertFalse(self.updater.journal_path.exists())

    def test_storage_rejects_postgres_18_anonymous_data(self):
        config = {'name': 'shoot-it', 'services': {'app': {'environment': {'DATABASE_URL': 'postgresql://postgres:test@db/test'}, 'volumes': [{'type': 'volume', 'source': 'uploads', 'target': '/app/uploads'}]}, 'db': {'volumes': [
            {'type': 'volume', 'source': 'db_data', 'target': '/var/lib/postgresql'}]}},
            'volumes': {'db_data': {'name': 'photoshoot_db_data'}, 'uploads': {'name': 'uploads'}}}
        self.updater.compose = lambda *args: json.dumps(config) if args[0] == 'config' else '/var/lib/postgresql/18/docker'
        def inspect(container):
            return {'Config': {'Labels': {'com.docker.compose.project': 'shoot-it'}, 'Env': ['DATABASE_URL=postgresql://postgres:test@db/test', 'POSTGRES_DB=test', 'POSTGRES_USER=postgres']}, 'Mounts':
                    [{'Destination': '/app/uploads', 'Type': 'volume', 'Name': 'uploads'}] if container == 'app' else
                    [{'Destination': '/var/lib/postgresql', 'Type': 'volume', 'Name': self.volume}]}
        self.updater.inspect = inspect
        self.volume = 'anonymous-unmanaged-volume'
        with self.assertRaisesRegex(RuntimeError, 'persistent mount'):
            self.updater.check_storage('app', 'db')
        self.volume = 'photoshoot_db_data'
        self.updater.check_storage('app', 'db')

    def test_exclusive_lock_skips_second_process(self):
        with open(self.updater.state / 'lock', 'a') as file:
            update.fcntl.flock(file, update.fcntl.LOCK_EX | update.fcntl.LOCK_NB)
            self.updater.execute('run')
        self.assertEqual(self.events, [])

    def test_low_disk_space_aborts_before_stopping(self):
        self.updater.check_storage = lambda *args: None
        self.updater.compose = lambda *args: '100'
        with patch('update.run', return_value='100 /app/uploads'), patch('update.shutil.disk_usage', return_value=type('Disk', (), {'free': 0})()):
            with self.assertRaisesRegex(RuntimeError, 'backup space'):
                update.Updater.preflight(self.updater, 'app', 'db')
        self.assertNotIn('stop', self.events)

    def test_redirect_does_not_leak_token(self):
        request = update.urllib.request.Request('https://api.github.com/test', headers={'Authorization': 'Bearer private'})
        redirected = update.SafeRedirect().redirect_request(request, None, 302, '', {}, 'https://release-assets.githubusercontent.com/test')
        self.assertFalse(redirected.has_header('Authorization'))
        with self.assertRaises(ValueError):
            update.SafeRedirect().redirect_request(request, None, 302, '', {}, 'http://insecure.test/')


if __name__ == '__main__':
    unittest.main()
