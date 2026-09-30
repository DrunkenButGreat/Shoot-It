// No downloads at startup: use the Prisma CLI pinned in package-lock.json.
const { spawnSync } = require('node:child_process')
const { PrismaClient } = require('@prisma/client')

function prisma(args) {
  const result = spawnSync(process.execPath, [require.resolve('prisma/build/index.js'), ...args], { stdio: 'inherit' })
  if (result.error || result.status !== 0) throw new Error('Prisma command failed; inspect the migration before restarting the app.')
}

async function main() {
  const action = process.argv[2] || 'deploy'
  if (!['deploy', 'baseline', 'upgrade'].includes(action)) throw new Error('Usage: node scripts/migrate.cjs [deploy|baseline|upgrade]')
  if (action !== 'deploy') {
    const db = new PrismaClient()
    try {
      // Never mark a mismatching, empty or previously migrated database as initialized.
      const tables = await db.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname = current_schema()`
      if (action === 'upgrade' && tables.some(t => t.tablename === '_prisma_migrations')) {
        prisma(['migrate', 'deploy'])
        return
      }
      if (!tables.some(t => t.tablename === 'User') || tables.some(t => t.tablename === '_prisma_migrations')) {
        throw new Error('Baseline requires an existing 1.11.0 database without a migration history.')
      }
      if (action === 'upgrade') {
        // Explicit, backed-up maintenance action only; never automatic at app startup.
        // This SQL only adds the 1.11 fields/tables and preserves existing settings.
        prisma(['db', 'execute', '--file', 'prisma/upgrades/1.11.0.sql', '--schema', 'prisma/schema.prisma'])
      }
      prisma(['migrate', 'diff', '--from-schema-datasource', 'prisma/schema.prisma', '--to-schema-datamodel', 'prisma/baseline.prisma', '--exit-code'])
      prisma(['migrate', 'resolve', '--applied', '0_init'])
      if (action === 'upgrade') prisma(['migrate', 'deploy'])
    } finally {
      await db.$disconnect()
    }
  } else {
    prisma(['migrate', 'deploy'])
  }
}

main().catch(error => { console.error(error.message); process.exitCode = 1 })
