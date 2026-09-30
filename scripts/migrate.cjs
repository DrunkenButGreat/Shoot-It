// No downloads at startup: use the Prisma CLI pinned in package-lock.json.
const { spawnSync } = require('node:child_process')
const { PrismaClient } = require('@prisma/client')
const fs = require('node:fs')
const path = require('node:path')

const backups = path.resolve('uploads/.shoot-it-migrations')
const pending = path.join(backups, 'pending.json')

function sync(file) {
  const fd = fs.openSync(file, 'r')
  try { fs.fsyncSync(fd) } finally { fs.closeSync(fd) }
}

function legacyBackup() {
  const uploads = path.dirname(backups)
  // A container's writable layer is lost when its image is replaced.
  const mounted = fs.readFileSync('/proc/self/mountinfo', 'utf8').split('\n').some(line =>
    line.split(' ')[4]?.replace(/\\([0-7]{3})/g, (_, octal) => String.fromCharCode(parseInt(octal, 8))) === uploads)
  if (!mounted) throw new Error('Legacy startup migration requires a persistent volume mounted at /app/uploads.')
  fs.mkdirSync(backups, { recursive: true, mode: 0o700 })
  const directory = fs.mkdtempSync(path.join(backups, 'legacy-'))
  const file = path.join(directory, 'database.dump')
  // Keep credentials out of arguments and Prisma-only options out of libpq.
  const address = new URL(process.env.DATABASE_URL)
  const env = { ...process.env, PGHOST: address.hostname.replace(/^\[|\]$/g, ''), PGPORT: address.port || '5432',
    PGUSER: decodeURIComponent(address.username), PGPASSWORD: decodeURIComponent(address.password),
    PGDATABASE: decodeURIComponent(address.pathname.slice(1)) }
  for (const [option, variable] of Object.entries({ sslmode: 'PGSSLMODE', sslcert: 'PGSSLCERT', sslkey: 'PGSSLKEY',
    sslrootcert: 'PGSSLROOTCERT', connect_timeout: 'PGCONNECT_TIMEOUT' })) {
    if (address.searchParams.has(option)) env[variable] = address.searchParams.get(option)
  }
  try {
    for (const [command, args] of [['pg_dump', ['--no-password', '-Fc', '-f', file]], ['pg_restore', ['--list', file]]]) {
      const result = spawnSync(command, args, { env,
        stdio: ['ignore', 'ignore', 'inherit'], timeout: 3600000 })
      if (result.error || result.status !== 0) throw new Error(`${command} failed. No startup schema changes were made; check database access, backup permissions and disk space.`)
    }
    if (!fs.statSync(file).size) throw new Error('Empty database backup; startup migration aborted.')
    sync(file)
    sync(directory)
    console.log(`Legacy database backup verified: ${file}`)
    return file
  } catch (error) {
    fs.rmSync(directory, { recursive: true, force: true })
    throw error
  }
}

function prisma(args) {
  const result = spawnSync(process.execPath, [require.resolve('prisma/build/index.js'), ...args], { stdio: 'inherit' })
  if (result.error || result.status !== 0) throw new Error('Prisma command failed; inspect the migration before restarting the app.')
}

async function main() {
  const action = process.argv[2] || 'deploy'
  if (!['start', 'deploy', 'baseline', 'upgrade'].includes(action)) throw new Error('Usage: node scripts/migrate.cjs [start|deploy|baseline|upgrade]')
  process.umask(0o077)
  const db = new PrismaClient()
  const schema = new URL(process.env.DATABASE_URL).searchParams.get('schema') || 'public'
  try {
    await db.$transaction(async tx => {
      // One connection holds this lock across the backup and all CLI commands.
      const [lock] = await tx.$queryRaw`SELECT pg_try_advisory_xact_lock(1397247828, hashtext(${schema})) AS acquired`
      if (!lock.acquired) throw new Error('Another database migration is running; retry after it finishes.')
      if (action === 'start' && fs.existsSync(pending)) {
        throw new Error(`Interrupted startup migration. Inspect ${pending} and deploy/QNAP-UPDATES.md before retrying; the app remains stopped.`)
      }
      const tables = await tx.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname = current_schema()`
      const recorded = tables.some(t => t.tablename === '_prisma_migrations')
      if (action === 'deploy' || (action !== 'baseline' && recorded) || (action === 'start' && tables.length === 0)) {
        prisma(['migrate', 'deploy'])
        return
      }
      if (!tables.some(t => t.tablename === 'User') || recorded) {
        throw new Error('Baseline requires an existing 1.11.0 database without a migration history.')
      }
      if (action === 'start') {
        const file = legacyBackup()
        fs.writeFileSync(pending, JSON.stringify({ backup: file, targetVersion: require('../package.json').version }) + '\n', { flag: 'wx' })
        sync(pending)
        sync(backups)
        sync(path.dirname(backups))
      }
      if (action === 'upgrade' || action === 'start') {
        // Upgrade is called by the backed-up updater; start has its own backup.
        // Both bridges only add known fields/tables and preserve existing values.
        prisma(['db', 'execute', '--file', 'prisma/upgrades/1.9.0.sql', '--schema', 'prisma/schema.prisma'])
        prisma(['db', 'execute', '--file', 'prisma/upgrades/1.11.0.sql', '--schema', 'prisma/schema.prisma'])
      }
      prisma(['migrate', 'diff', '--from-schema-datasource', 'prisma/schema.prisma', '--to-schema-datamodel', 'prisma/baseline.prisma', '--exit-code'])
      prisma(['migrate', 'resolve', '--applied', '0_init'])
      if (action !== 'baseline') prisma(['migrate', 'deploy'])
      if (action === 'start') fs.unlinkSync(pending)
    }, { timeout: 4 * 3600000 })
  } finally {
    await db.$disconnect()
  }
}

main().catch(error => { console.error(error.message); process.exitCode = 1 })
