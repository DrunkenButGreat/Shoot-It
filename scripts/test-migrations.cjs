// Real PostgreSQL, synthetic schemas only. Never reset an application database.
const assert = require('node:assert/strict')
const { randomUUID } = require('node:crypto')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const { PrismaClient } = require('@prisma/client')
const Module = require('node:module')
const ts = require('typescript')

async function main() {
  const url = new URL(process.env.TEST_DATABASE_URL || 'invalid:')
  assert.match(url.protocol, /^postgres(ql)?:$/)
  assert.match(url.pathname, /_test$/)
  if (process.env.DATABASE_URL) {
    const regular = new URL(process.env.DATABASE_URL)
    assert.notEqual(`${url.host}${url.pathname}`, `${regular.host}${regular.pathname}`)
  }
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'shoot-it-migrations-'))
  fs.cpSync('prisma', path.join(temp, 'prisma'), { recursive: true })
  const migrate = path.resolve('scripts/migrate.cjs')
  const cli = require.resolve('prisma/build/index.js')
  const clients = []
  function database() {
    const schema = `update_test_${randomUUID().replaceAll('-', '')}`
    url.searchParams.set('schema', schema)
    const address = url.toString()
    const db = new PrismaClient({ datasources: { db: { url: address } } })
    clients.push({ db, schema })
    const command = (args, success = true) => {
      const result = spawnSync(process.execPath, args, { cwd: temp, env: { ...process.env, DATABASE_URL: address }, encoding: 'utf8' })
      if (success) assert.equal(result.status, 0, result.stderr + result.stdout)
      else assert.notEqual(result.status, 0)
    }
    return { db, command }
  }
  function readiness(db) {
    const filename = path.resolve('src/app/api/ready/route.ts')
    const mod = new Module(filename, module)
    mod.filename = filename
    mod.paths = module.paths
    mod.require = id => id === '@/lib/prisma' ? { __esModule: true, default: db }
      : id.endsWith('package.json') ? require('../package.json') : require(id)
    mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, filename)
    return mod.exports.GET
  }
  try {
    const fresh = database()
    fresh.command([migrate, 'deploy'])
    const user = await fresh.db.user.create({ data: { email: 'preserved@example.test', name: 'Preserved', isAdmin: true } })
    await fresh.db.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(1397247828, hashtext(current_schema()))`
      fresh.command([migrate, 'deploy'], false)
    }, { timeout: 30000 })
    fresh.command([migrate, 'deploy'])
    const ready = readiness(fresh.db)
    assert.equal((await ready()).status, 200)
    assert.equal((await (await ready()).json()).version, require('../package.json').version)

    const legacy = database()
    legacy.command([cli, 'db', 'push', '--skip-generate'])
    const old = await legacy.db.user.create({ data: { email: 'legacy@example.test', isAdmin: true } })
    await legacy.db.registrationSettings.create({ data: { id: 'global', mode: 'CLOSED' } })
    const later = await legacy.db.user.create({ data: { email: 'later-admin@example.test', isAdmin: true, createdAt: new Date('2099-01-01') } })
    await legacy.db.$executeRawUnsafe('ALTER TABLE "User" DROP COLUMN "isOwner"')
    legacy.command([migrate, 'deploy'], false) // never silently baseline
    legacy.command([migrate, 'baseline'])
    legacy.command([migrate, 'deploy'])
    assert.equal((await legacy.db.user.findUnique({ where: { id: old.id } })).isAdmin, true)
    assert.equal((await legacy.db.user.findUnique({ where: { id: old.id } })).isOwner, true)
    assert.equal((await legacy.db.user.findUnique({ where: { id: later.id } })).isAdmin, true)
    assert.equal((await legacy.db.user.findUnique({ where: { id: later.id } })).isOwner, false)
    assert.equal((await legacy.db.registrationSettings.findUnique({ where: { id: 'global' } })).mode, 'CLOSED')
    legacy.command([migrate, 'baseline'], false)
    legacy.command([migrate, 'upgrade']) // already-baselined installations skip legacy SQL
    assert.equal((await legacy.db.registrationSettings.findUnique({ where: { id: 'global' } })).mode, 'CLOSED')
    assert.equal(await legacy.db.user.count({ where: { isOwner: true } }), 1)

    const before111 = database()
    before111.command([cli, 'db', 'push', '--skip-generate'])
    await before111.db.user.create({ data: { email: 'before111@example.test' } })
    for (const sql of ['DROP TABLE "RegistrationInvite"', 'DROP TABLE "RegistrationSettings"',
                       'DROP TYPE "RegistrationMode"', 'ALTER TABLE "User" DROP COLUMN "isAdmin", DROP COLUMN "isOwner"']) {
      await before111.db.$executeRawUnsafe(sql)
    }
    // Stock 1.8.x schema: the subsequent changes were purely additive.
    for (const [table, fields] of [['User', ['brandingColor', 'brandingImage']],
      ['Project', ['brandingColor', 'brandingImage', 'allowSelectionDownload', 'showSelectionFolders']],
      ['MoodboardImage', ['isVideo', 'duration']], ['ResultFile', ['isVideo', 'duration']]]) {
      for (const field of fields) await before111.db.$executeRawUnsafe(`ALTER TABLE "${table}" DROP COLUMN "${field}"`)
    }
    await before111.db.$executeRawUnsafe('INSERT INTO "Project" (id,name,"shortCode","ownerId","updatedAt") SELECT \'old-project\',\'Preserved project\',\'old\',id,NOW() FROM "User" LIMIT 1')
    before111.command([migrate, 'upgrade'])
    before111.command([migrate, 'upgrade'])
    assert.equal((await before111.db.user.findUnique({ where: { email: 'before111@example.test' } })).isAdmin, true)
    assert.equal((await before111.db.user.findUnique({ where: { email: 'before111@example.test' } })).isOwner, true)
    assert.equal((await before111.db.registrationSettings.findUnique({ where: { id: 'global' } })).mode, 'OPEN')
    const oldProject = await before111.db.project.findUnique({ where: { id: 'old-project' } })
    assert.equal(oldProject.name, 'Preserved project')
    assert.equal(oldProject.showSelectionFolders, true)
    assert.equal(oldProject.allowSelectionDownload, false)
    assert.equal(oldProject.brandingColor, null)

    const drift = database()
    drift.command([cli, 'db', 'push', '--skip-generate'])
    await drift.db.$executeRawUnsafe('ALTER TABLE "User" DROP COLUMN "isAdmin", DROP COLUMN "isOwner"')
    drift.command([migrate, 'baseline'], false)
    const tables = await drift.db.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname = current_schema() AND tablename = '_prisma_migrations'`
    assert.equal(tables.length, 0)
    assert.equal((await readiness(drift.db)()).status, 503)
    await drift.db.$executeRawUnsafe('ALTER TABLE "User" DROP COLUMN "bio"')
    drift.command([migrate, 'upgrade'], false) // unrelated drift is not accepted by the bridge
    assert.equal((await drift.db.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname = current_schema() AND tablename = '_prisma_migrations'`).length, 0)

    // Skipping an app release still applies every migration, in order.
    for (const [name, sql] of [['1_add_note', 'ALTER TABLE "User" ADD COLUMN "updateTestNote" TEXT;'],
                              ['2_fill_note', 'UPDATE "User" SET "updateTestNote" = \'preserved\';']]) {
      fs.mkdirSync(path.join(temp, 'prisma/migrations', name))
      fs.writeFileSync(path.join(temp, 'prisma/migrations', name, 'migration.sql'), `BEGIN;\n${sql}\nCOMMIT;\n`)
    }
    fresh.command([migrate, 'deploy'])
    assert.equal((await fresh.db.$queryRaw`SELECT "updateTestNote" FROM "User" WHERE id = ${user.id}`)[0].updateTestNote, 'preserved')
    assert.equal((await fresh.db.user.findUnique({ where: { id: user.id } })).isAdmin, true)
    fs.mkdirSync(path.join(temp, 'prisma/migrations/3_failure'))
    fs.writeFileSync(path.join(temp, 'prisma/migrations/3_failure/migration.sql'), 'BEGIN; ALTER TABLE "User" ADD COLUMN "mustNotExist" TEXT; SELECT 1/0; COMMIT;')
    fresh.command([migrate, 'deploy'], false)
    fresh.command([migrate, 'deploy'], false)
    const columns = await fresh.db.$queryRaw`SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND column_name = 'mustNotExist'`
    assert.equal(columns.length, 0)
    assert.equal(await fresh.db.user.count(), 1)
    console.log('PASS: fresh/repeated deploy, exact legacy baseline preserves data, drift rejection, readiness 200/503, skipped versions and transactional migration failure.')
  } finally {
    for (const { db, schema } of clients) {
      await db.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`)
      await db.$disconnect()
    }
    fs.rmSync(temp, { recursive: true, force: true })
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
