#!/usr/bin/env python3
"""Shared release, command and journal helpers for the Docker updater."""
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
import urllib.error
import urllib.request

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
        # Docker diagnostics can contain secrets; keep them out of the journal.
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
