// No downloads at startup: use the Prisma CLI pinned in package-lock.json.
const { spawnSync } = require('node:child_process')
const { PrismaClient } = require('@prisma/client')

function prisma(args) {
  const result = spawnSync(process.execPath, [require.resolve('prisma/build/index.js'), ...args], { stdio: 'inherit' })
  if (result.error || result.status !== 0) throw new Error('Prisma command failed; inspect the migration before restarting the app.')
}

async function main() {
  const action = process.argv[2] || 'deploy'
  if (!['deploy', 'baseline'].includes(action)) throw new Error('Usage: node scripts/migrate.cjs [deploy|baseline]')
  if (action === 'baseline') {
    const db = new PrismaClient()
    try {
      // Never mark a mismatching, empty or previously migrated database as initialized.
      const tables = await db.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname = current_schema()`
      if (!tables.some(t => t.tablename === 'User') || tables.some(t => t.tablename === '_prisma_migrations')) {
        throw new Error('Baseline requires an existing 1.11.0 database without a migration history.')
      }
      prisma(['migrate', 'diff', '--from-schema-datasource', 'prisma/schema.prisma', '--to-schema-datamodel', 'prisma/baseline.prisma', '--exit-code'])
      prisma(['migrate', 'resolve', '--applied', '0_init'])
    } finally {
      await db.$disconnect()
    }
  } else {
    prisma(['migrate', 'deploy'])
  }
}

main().catch(error => { console.error(error.message); process.exitCode = 1 })
