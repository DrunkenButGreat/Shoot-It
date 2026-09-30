"""Small offline checks for the Docker replacement contract and release policy."""
import copy
import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('container_update', Path(__file__).with_name('container-update.py'))
updater = importlib.util.module_from_spec(spec)
spec.loader.exec_module(updater)


class ContainerChecks(unittest.TestCase):
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


if __name__ == '__main__':
    unittest.main()
