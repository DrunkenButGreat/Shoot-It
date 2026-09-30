// Exercise the actual publication shell step without contacting GitHub or GHCR.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const yaml = require('js-yaml')
const workflow = yaml.load(fs.readFileSync('.github/workflows/docker-publish.yml', 'utf8'))
const job = workflow.jobs['build-and-push']
const steps = job.steps
const promoteIndex = steps.findIndex(step => step.name === 'Promote latest for manual Compose updates')
const promote = steps[promoteIndex]
assert.equal(promote.if, "github.event_name == 'release'")
assert.ok(job.if.includes('!github.event.release.prerelease'))
assert.ok(workflow.concurrency.group.includes('stable-releases'))
assert.ok(promoteIndex > steps.findIndex(step => step.name === 'Verify published image with disposable data'))
assert.ok(promoteIndex > steps.findIndex(step => step.name === 'Publish automatic-update manifest'))
assert.equal(yaml.load(fs.readFileSync('docker-compose.yml', 'utf8')).services.app.image,
  '${SHOOT_IT_IMAGE:-ghcr.io/drunkenbutgreat/shoot-it:latest}')
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'shootit-release-'))
try {
  fs.writeFileSync(path.join(temp, 'gh'), '#!/bin/sh\n[ "$API_FAILURE" != 1 ] || exit 1\nprintf "%s\\n" "$LATEST_TAG"\n', { mode: 0o755 })
  fs.writeFileSync(path.join(temp, 'docker'), '#!/bin/sh\nprintf "%s\\n" "$*"\n', { mode: 0o755 })
  const env = { ...process.env, PATH: `${temp}:${process.env.PATH}`, RELEASE_TAG: 'v1.12.0', IMAGE_DIGEST: `sha256:${'a'.repeat(64)}` }
  const run = extra => spawnSync('sh', ['-eu', '-c', promote.run], { env: { ...env, ...extra }, encoding: 'utf8' })
  const current = run({ LATEST_TAG: 'v1.12.0' })
  assert.equal(current.status, 0, current.stderr)
  assert.equal(current.stdout.trim(), `buildx imagetools create --tag ghcr.io/drunkenbutgreat/shoot-it:latest ghcr.io/drunkenbutgreat/shoot-it@${env.IMAGE_DIGEST}`)
  const older = run({ LATEST_TAG: 'v1.13.0' })
  assert.equal(older.status, 0, older.stderr)
  assert.equal(older.stdout, '')
  const failed = run({ API_FAILURE: '1' })
  assert.notEqual(failed.status, 0)
  assert.equal(failed.stdout, '')
  console.log('PASS: stable latest promotion only after verification; older releases and API failures cannot publish; manual Compose default preserved.')
} finally {
  fs.rmSync(temp, { recursive: true, force: true })
}
