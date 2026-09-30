#!/usr/bin/env python3
"""Emit the update contract only after a tested image has been published."""
import json
import os
from pathlib import Path
from update import eligible, IMAGE, version

package = json.loads(Path('package.json').read_text())
policy = json.loads(Path('deploy/auto-update.json').read_text())
release_version = package['version']
version(release_version)
manifest = {**policy, 'version': release_version, 'image': f"{IMAGE}@{os.environ['IMAGE_DIGEST']}"}
# Also validates protocol, digest and exact tag/package agreement for the first release.
eligible(manifest, policy['minVersion'], os.environ['RELEASE_TAG'])
print(json.dumps(manifest, indent=2))
