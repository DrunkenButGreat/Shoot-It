#!/usr/bin/env python3
"""Check real management control flow with temporary paths and mocked host services."""
from contextlib import ExitStack
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import autoupdate
from update import Updater


class ManagementChecks(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='shootit manager ')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.project = self.root / 'project with spaces'
        self.project.mkdir()
        (self.project / '.env').write_text('KEEP=unchanged\n')
        (self.project / 'docker-compose.yml').write_text('services: {}\n')
        self.units = self.root / 'units'
        self.units.mkdir()
        self.config_path = self.root / 'config.json'
        self.config = {'projectDirectory': str(self.project), 'stateDirectory': str(self.root / 'state'),
                       'backupDirectory': str(self.root / 'backups'), 'composeFiles': ['docker-compose.yml'], 'windowHours': [1, 3]}
        self.updater = Updater(self.config)
        self.updater.containers = lambda: ('app', 'db')
        self.updater.current = lambda _: '1.12.0'
        self.updater.compose = lambda *args, **kwargs: ''
        self.updater.check_image_override = lambda: None
        self.updater.preflight = lambda *args: None
        self.updater.inspect = lambda _: {'Image': 'sha256:' + 'a' * 64, 'Mounts': [
            {'Destination': '/app/uploads', 'Source': str(self.root / 'uploads')}]}
        self.commands = []
        self.updater.pin = lambda image: self.commands.append(['pin', image])
        self.active = 'inactive'
        self.loaded = 'not-found'
        self.service_active = 'inactive'
        stack = ExitStack()
        self.addCleanup(stack.close)
        for name, value in [('CONFIG', self.config_path), ('INSTALLED', self.root / 'installed/update.py'), ('UNITS', self.units)]:
            stack.enter_context(patch.object(autoupdate, name, value))
        stack.enter_context(patch.object(autoupdate, 'Updater', return_value=self.updater))
        stack.enter_context(patch.object(autoupdate.shutil, 'which', return_value='/usr/bin/docker'))
        stack.enter_context(patch.dict(autoupdate.os.environ, {'DOCKER_HOST': '', 'DOCKER_CONTEXT': ''}))
        stack.enter_context(patch.object(autoupdate, 'run', side_effect=self.command))

    def command(self, args):
        self.commands.append(args)
        if args[:3] == ['docker', 'context', 'inspect']: return 'unix:///var/run/docker.sock'
        if args[:2] == ['docker', 'info']: return 'linux'
        if args[:3] == ['docker', 'compose', 'version']: return '2.39.0'
        if args[0] == '/usr/bin/python3': return '3.11.0'
        if args[:2] == ['systemctl', 'show']:
            if args[2] == 'docker.service': return 'loaded'
            if args[4] == 'LoadState': return self.loaded
            return self.service_active if args[2] == autoupdate.SERVICE else self.active
        if args[:2] == ['systemctl', 'enable']:
            self.active, self.loaded = 'active', 'loaded'
        if args[:2] == ['systemctl', 'disable']:
            self.active = 'inactive'
        return ''

    def test_check_is_read_only_and_handles_spaces_and_missing_backup_directory(self):
        before = sorted(str(p) for p in self.root.rglob('*'))
        autoupdate.requirements(self.config)
        self.assertEqual(sorted(str(p) for p in self.root.rglob('*')), before)
        self.assertEqual((self.project / '.env').read_text(), 'KEEP=unchanged\n')
        self.assertFalse(any(c[0] == 'pin' or c[:2] == ['systemctl', 'enable'] for c in self.commands))

    def test_enable_installs_only_after_checks_and_disable_preserves_files(self):
        autoupdate.enable(self.config)
        self.assertEqual(json.loads(self.config_path.read_text()), self.config)
        self.assertEqual(autoupdate.INSTALLED.read_text(), (autoupdate.SOURCE / 'scripts/update.py').read_text())
        self.assertTrue((self.units / autoupdate.TIMER).is_file())
        self.assertEqual(self.active, 'active')
        self.assertLess(next(i for i, c in enumerate(self.commands) if c[0] == 'pin'),
                        self.commands.index(['systemctl', 'enable', '--now', autoupdate.TIMER]))
        self.service_active = 'activating'
        files = sorted(str(p) for p in self.root.rglob('*'))
        autoupdate.disable()
        self.assertEqual(self.active, 'inactive')
        self.assertEqual(sorted(str(p) for p in self.root.rglob('*')), files)
        self.assertNotIn(['systemctl', 'stop', autoupdate.SERVICE], self.commands)
        self.assertEqual((self.project / '.env').read_text(), 'KEEP=unchanged\n')

    def test_disable_works_without_installation_or_docker(self):
        with patch.object(autoupdate, 'Updater', side_effect=AssertionError('Must not inspect Docker')):
            autoupdate.disable()
        self.assertFalse(any(c[0] == 'docker' for c in self.commands))
        self.assertFalse(self.config_path.exists())

    def test_missing_env_never_enables_or_creates_config(self):
        (self.project / '.env').unlink()
        with self.assertRaisesRegex(ValueError, '.env'):
            autoupdate.enable(self.config)
        self.assertFalse(self.config_path.exists())
        self.assertNotIn(['systemctl', 'enable', '--now', autoupdate.TIMER], self.commands)

    def test_existing_configuration_is_kept_and_wrong_project_rejected(self):
        self.config_path.write_text(json.dumps(self.config))
        self.assertEqual(autoupdate.configuration(), self.config)
        with self.assertRaisesRegex(ValueError, 'another projectDirectory'):
            autoupdate.configuration(project='/a/different/project')
        self.assertEqual(json.loads(self.config_path.read_text()), self.config)

    def test_running_service_prevents_enable(self):
        self.service_active = 'activating'
        with self.assertRaisesRegex(RuntimeError, 'running'):
            autoupdate.enable(self.config)
        self.assertFalse(self.updater.state.exists())

    def test_failed_migration_prevents_enable(self):
        self.updater.state.mkdir()
        self.updater.journal({'phase': 'migrating'}, 'migrating')
        with self.assertRaisesRegex(RuntimeError, 'manual recovery'):
            autoupdate.enable(self.config)
        self.assertNotIn(['systemctl', 'enable', '--now', autoupdate.TIMER], self.commands)

    def test_locked_updater_prevents_check(self):
        self.updater.state.mkdir()
        with open(self.updater.state / 'lock', 'a') as lock:
            autoupdate.fcntl.flock(lock, autoupdate.fcntl.LOCK_EX | autoupdate.fcntl.LOCK_NB)
            with self.assertRaisesRegex(RuntimeError, 'running'):
                autoupdate.requirements(self.config)

    def test_remote_docker_override_rejected(self):
        with patch.dict(autoupdate.os.environ, {'DOCKER_HOST': 'ssh://remote'}):
            with self.assertRaisesRegex(RuntimeError, 'Unset DOCKER_HOST'):
                autoupdate.requirements(self.config)

    def test_missing_docker_system_service_rejected(self):
        with patch.object(autoupdate, 'unit_property', return_value='not-found'):
            with self.assertRaisesRegex(RuntimeError, 'docker.service is required'):
                autoupdate.requirements(self.config)

    def test_missing_compose_and_backups_inside_uploads_rejected(self):
        self.config['composeFiles'] = ['missing.yml']
        with self.assertRaisesRegex(ValueError, 'Compose file'):
            autoupdate.requirements(self.config)
        self.config['composeFiles'] = ['docker-compose.yml']
        self.updater.backups = (self.root / 'uploads/backups').resolve()
        with self.assertRaisesRegex(ValueError, 'outside the live uploads'):
            autoupdate.requirements(self.config)


if __name__ == '__main__':
    unittest.main()
