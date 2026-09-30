#!/bin/sh
# Backward-compatible installer entry point; all checks live in autoupdate.py.
set -eu
script_dir=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
exec python3 "$script_dir/autoupdate.py" enable "$@"
