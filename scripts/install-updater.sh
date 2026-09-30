#!/bin/sh
set -eu
if [ "$(id -u)" != 0 ] || [ "$(uname -s)" != Linux ]; then
  echo 'Run with sudo on a Linux Docker host with systemd.' >&2
  exit 1
fi
project=$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)
command -v python3 >/dev/null
command -v systemctl >/dev/null
if [ -e /etc/shoot-it-updater.json ]; then
  echo 'Keeping existing updater configuration.'
else
umask 077
python3 - "$project" <<'PY'
import json, pathlib, sys
project = pathlib.Path(sys.argv[1])
files = ['docker-compose.yml']
if (project / 'docker-compose.override.yml').exists():
    files.append('docker-compose.override.yml')
config = {'projectDirectory': str(project), 'composeFiles': files,
          'stateDirectory': '/var/lib/shoot-it-updater',
          'backupDirectory': '/var/backups/shoot-it', 'windowHours': [3, 5]}
with open('/etc/shoot-it-updater.json', 'x') as file:
    json.dump(config, file, indent=2)
PY
fi
# On failure leave the configuration for diagnosis, but never enable the timer.
python3 "$project/scripts/update.py" init
install -d -m 755 /usr/local/lib/shoot-it
install -m 644 "$project/scripts/update.py" /usr/local/lib/shoot-it/update.py
install -m 644 "$project/deploy/shoot-it-updater.service" /etc/systemd/system/
install -m 644 "$project/deploy/shoot-it-updater.timer" /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now shoot-it-updater.timer
echo 'Updater enabled. Maintenance hours are configured in /etc/shoot-it-updater.json (host local time).'
