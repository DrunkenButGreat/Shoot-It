"""Small offline checks for the Docker replacement contract and release policy."""
import copy
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import Mock, patch

spec = importlib.util.spec_from_file_location('container_update', Path(__file__).with_name('container-update.py'))
updater = importlib.util.module_from_spec(spec)
spec.loader.exec_module(updater)


class ContainerChecks(unittest.TestCase):
    def test_migration_only_success_and_failure_boundaries(self):
        for failure in (None, 'backup', 'migration'):
            with self.subTest(failure=failure), tempfile.TemporaryDirectory() as directory:
                instance = updater.ContainerUpdater.__new__(updater.ContainerUpdater)
                instance.data = Path(directory)
                instance.journal_path = instance.data / 'transaction.json'
                instance.app_name = 'app'
                instance.current = '1.8.2'
                instance.app = {'Id': 'old-app', 'Image': 'old-image', 'Config': {'Env': []}, 'State': {'Running': True}}
                instance.db = {'Id': 'db'}
                instance.prefix, instance.network = '/v1.47', 'network'
                instance.backup = Mock(side_effect=RuntimeError('backup failed') if failure == 'backup' else None)
                instance.restore_restart = Mock()
                calls = []
                def command(args, **kwargs):
                    calls.append(args)
                    if args[:2] == ['docker', 'run']: return '1.16.0'
                    if args[:2] == ['docker', 'wait']: return '1' if failure == 'migration' else '0'
                    return ''
                with patch.object(updater, 'run', side_effect=command), patch.object(updater, 'inspect', return_value={'State': {'Running': False}}), patch.object(updater, 'api', return_value={'Id': 'migration'}) as api:
                    if failure:
                        with self.assertRaises(RuntimeError):
                            instance.apply({'image': 'target', 'version': '1.16.0'}, {}, migration_only=True)
                    else:
                        instance.apply({'image': 'target', 'version': '1.16.0'}, {}, migration_only=True)
                state = json.loads(instance.journal_path.read_text())
                self.assertEqual(state['phase'], {None: 'migrated', 'backup': 'backup-failed', 'migration': 'migration-failed'}[failure])
                self.assertTrue(instance.backup.call_args.kwargs['database_only'])
                self.assertNotIn(['docker', 'rm', 'old-app'], calls)
                self.assertFalse(any(call[:2] == ['docker', 'rename'] for call in calls))
                if failure == 'backup':
                    api.assert_not_called()
                    instance.restore_restart.assert_called_once()
                    self.assertIn(['docker', 'start', 'old-app'], calls)
                else:
                    self.assertNotIn(['docker', 'start', 'old-app'], calls)
                if failure == 'migration':
                    with self.assertRaisesRegex(RuntimeError, 'Unfinished update'):
                        instance.transaction()

    def test_preserves_settings_and_real_volumes_but_uses_new_startup(self):
        old = {'Id': 'a' * 64, 'Config': {'Image': 'old', 'Hostname': 'a' * 12,
               'Env': ['AUTH_SECRET=keep $ and spaces', 'PORT=3000'], 'Cmd': ['sh', '-c', 'npx prisma db push'],
               'Labels': {'com.docker.compose.project': 'photoshoot'}, 'Healthcheck': {'Test': ['NONE']}},
               'HostConfig': {'Binds': ['/share/photos:/app/local_media:ro'], 'Mounts': [],
                              'Memory': 1024, 'PortBindings': {'3000/tcp': [{'HostPort': '8080'}]},
                              'RestartPolicy': {'Name': 'unless-stopped'}},
               'Mounts': [{'Type': 'volume', 'Name': 'anonymous-uploads', 'Destination': '/app/uploads', 'RW': True},
                          {'Type': 'bind', 'Source': '/share/photos', 'Destination': '/app/local_media', 'RW': False}],
               'NetworkSettings': {'Networks': {'project': {'Aliases': ['app', 'a' * 12], 'IPAddress': '172.18.0.2'},
                                                'extra': {'Aliases': ['photos']}}}}
        original = copy.deepcopy(old)
        new = updater.replacement(old, 'new', {'Cmd': ['node', 'server.js'], 'User': 'nextjs',
                      'Env': ['DEFAULT=new'], 'Healthcheck': {'Test': ['CMD', 'node', 'scripts/healthcheck.cjs']}})
        self.assertEqual(old, original)
        self.assertEqual(new['Cmd'], ['node', 'server.js'])
        self.assertEqual(new['HostConfig']['Memory'], 1024)
        self.assertEqual(new['HostConfig']['PortBindings'], old['HostConfig']['PortBindings'])
        self.assertEqual(new['HostConfig']['Binds'], ['/share/photos:/app/local_media:ro', 'anonymous-uploads:/app/uploads:rw'])
        self.assertIn('AUTH_SECRET=keep $ and spaces', new['Env'])
        self.assertIn('DEFAULT=new', new['Env'])
        self.assertNotIn('Hostname', new)
        self.assertEqual(new['NetworkingConfig']['EndpointsConfig'], {'project': {'Aliases': ['app']}})
        self.assertEqual(updater.endpoints(old)['extra'], {'Aliases': ['photos']})

    def test_bridge_requires_explicit_supported_contract(self):
        manifest = {'protocol': 1, 'containerProtocol': 1, 'minVersion': '1.12.0', 'legacyMinVersion': '1.10.0',
                    'version': '1.15.0', 'rollbackSafe': True,
                    'image': 'ghcr.io/drunkenbutgreat/shoot-it@sha256:' + 'a' * 64}
        for installed in ['1.10.0', '1.10.1', '1.11.0', '1.14.0']:
            self.assertTrue(updater.compatible(manifest, installed))
        for installed in ['1.9.0', '1.15.0', '2.0.0']:
            self.assertFalse(updater.compatible(manifest, installed))
        self.assertTrue(updater.compatible(manifest, '1.15.0', repair_legacy=True))
        self.assertFalse(updater.compatible({**manifest, 'rollbackSafe': False}, '1.14.0'))
        for changes in [{'containerProtocol': None}, {'image': 'untrusted:latest'}, {'legacyMinVersion': '1.0.0'}]:
            with self.assertRaises(ValueError):
                updater.compatible({**manifest, **changes}, '1.10.1')
        with self.assertRaisesRegex(ValueError, 'does not support the migrate command'):
            updater.compatible(manifest, '1.9.0', migration_only=True)
        migration = {**manifest, 'databaseMigrationMinVersion': '1.8.0'}
        for installed in ['1.8.0', '1.9.0', '1.10.1', '1.15.0']:
            self.assertTrue(updater.compatible(migration, installed, migration_only=True))
        for installed in ['1.7.9', '1.16.0', '2.0.0']:
            self.assertFalse(updater.compatible(migration, installed, migration_only=True))


if __name__ == '__main__':
    unittest.main()
