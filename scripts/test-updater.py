#!/usr/bin/env python3
"""Offline checks for the Docker updater's shared release/download contract."""
import unittest
from unittest.mock import patch
import update

TARGET = update.IMAGE + '@sha256:' + 'b' * 64
MANIFEST = {'protocol': 1, 'version': '1.14.0', 'minVersion': '1.12.0', 'rollbackSafe': True, 'image': TARGET}


class UpdateChecks(unittest.TestCase):
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

    def test_redirect_does_not_leak_token(self):
        request = update.urllib.request.Request('https://api.github.com/test', headers={'Authorization': 'Bearer private'})
        redirected = update.SafeRedirect().redirect_request(request, None, 302, '', {}, 'https://release-assets.githubusercontent.com/test')
        self.assertFalse(redirected.has_header('Authorization'))
        with self.assertRaises(ValueError):
            update.SafeRedirect().redirect_request(request, None, 302, '', {}, 'http://insecure.test/')

    def test_release_requires_a_complete_valid_manifest(self):
        for release in [{'draft': True}, {'prerelease': True}, {'tag_name': 'v1.14.0', 'assets': []}]:
            with self.subTest(release=release), patch('update.fetch', return_value=release):
                self.assertIsNone(update.latest_manifest())
        release = {'tag_name': 'v1.14.0', 'assets': [{'name': 'shoot-it-update.json', 'state': 'uploaded', 'id': 1}]}
        with patch('update.fetch', side_effect=[release, MANIFEST]):
            self.assertEqual(update.latest_manifest(), MANIFEST)
        with patch('update.fetch', side_effect=[{**release, 'tag_name': 'v1.13.0'}, MANIFEST]):
            with self.assertRaises(ValueError):
                update.latest_manifest()


if __name__ == '__main__':
    unittest.main()
