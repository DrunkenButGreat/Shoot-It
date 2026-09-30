// Uses a real PostgreSQL transaction boundary, with a disposable schema and no new dependencies.
const assert = require('node:assert/strict')
const { randomUUID } = require('node:crypto')
const { readFileSync } = require('node:fs')
const { resolve } = require('node:path')
const { execFileSync } = require('node:child_process')
const Module = require('node:module')
const ts = require('typescript')
const { PrismaClient } = require('@prisma/client')

async function main() {
  const url = new URL(process.env.TEST_DATABASE_URL || 'invalid:')
  assert.match(url.protocol, /^postgres(ql)?:$/)
  assert.match(url.pathname, /_test$/, 'Use a dedicated database whose name ends in _test')
  if (process.env.DATABASE_URL) {
    const regular = new URL(process.env.DATABASE_URL)
    assert.notEqual(`${url.host}${url.pathname}`, `${regular.host}${regular.pathname}`, 'Do not use the application database')
  }
  const schema = `registration_test_${randomUUID().replaceAll('-', '')}`
  url.searchParams.set('schema', schema)
  const databaseUrl = url.toString()
  const db = new PrismaClient({ datasources: { db: { url: databaseUrl } } })
  let session = null
  const cache = new Map()
  // Compile the production TS modules in memory; substitute only session/provider boundaries.
  function load(file, overrides = {}) {
    const path = resolve(file)
    if (cache.has(path) && !Object.keys(overrides).length) return cache.get(path).exports
    const mod = new Module(path, module)
    mod.filename = path
    mod.paths = module.paths
    mod.require = id => {
      if (id in overrides) return overrides[id]
      if (id === '@/lib/prisma') return { __esModule: true, default: db }
      if (id === '@/auth') return { auth: async () => session }
      if (id.startsWith('@/')) return load(`src/${id.slice(2)}.ts`)
      return require(id)
    }
    cache.set(path, mod)
    mod._compile(ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, path)
    return mod.exports
  }
  try {
    execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'db', 'push', '--skip-generate'], { env: { ...process.env, DATABASE_URL: databaseUrl }, stdio: 'pipe' })
    const { createRegisteredUser, getRegistrationMode, hashInvite } = load('src/lib/registration.ts')
    // Two simultaneous first signups must yield one owner, without trusting input roles.
    const firstUsers = await Promise.all(['first-a', 'first-b'].map(name =>
      createRegisteredUser({ email: `${name}@example.test`, isAdmin: true, isOwner: true })))
    assert.equal(firstUsers.filter(user => user.isOwner && user.isAdmin).length, 1)
    assert.equal(firstUsers.filter(user => !user.isOwner && !user.isAdmin).length, 1)
    const owner = firstUsers.find(user => user.isOwner)
    const member = firstUsers.find(user => !user.isOwner)
    session = { user: { id: owner.id } }
    assert.equal((await load('src/lib/admin.ts').getAdmin()).id, owner.id)
    session = null
    const adminCommand = action => execFileSync(process.execPath, ['scripts/admin.cjs', action, member.email],
      { env: { ...process.env, DATABASE_URL: databaseUrl }, stdio: 'pipe' })
    adminCommand('grant')
    assert.equal((await db.user.findUnique({ where: { id: member.id } })).isAdmin, true)
    adminCommand('revoke')
    assert.equal((await db.user.findUnique({ where: { id: member.id } })).isAdmin, false)
    assert.throws(() => execFileSync(process.execPath, ['scripts/admin.cjs', 'revoke', owner.email],
      { env: { ...process.env, DATABASE_URL: databaseUrl }, stdio: 'pipe' }), error =>
      error.stderr.toString().includes('instance owner must retain admin access'))
    assert.equal((await db.user.findUnique({ where: { id: owner.id } })).isAdmin, true)
    await db.user.deleteMany({ where: { id: { in: firstUsers.map(user => user.id) } } })
    const existing = await db.user.create({ data: { email: 'existing@example.test', name: 'Existing User', password: await require('bcryptjs').hash('test-password', 4) } })
    // Exercise the upgrade from the old schema, then repeat it after a policy change.
    await db.$executeRawUnsafe('DROP TABLE "RegistrationInvite", "RegistrationSettings"')
    await db.$executeRawUnsafe('DROP TYPE "RegistrationMode"')
    await db.$executeRawUnsafe('ALTER TABLE "User" DROP COLUMN "isAdmin"')
    const upgrade = () => execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'db', 'execute', '--file', 'prisma/upgrades/1.11.0.sql', '--schema', 'prisma/schema.prisma'], { env: { ...process.env, DATABASE_URL: databaseUrl }, stdio: 'pipe' })
    upgrade()
    assert.equal((await db.user.findUnique({ where: { id: existing.id } })).isAdmin, false)
    const mode = value => db.registrationSettings.upsert({ where: { id: 'global' }, create: { id: 'global', mode: value }, update: { mode: value } })
    const invite = (code, extra = {}) => db.registrationInvite.create({ data: { codeHash: hashInvite(code), expiresAt: new Date(Date.now() + 86400000), ...extra } })
    const user = email => ({ email: `${email}@example.test`, name: 'Synthetic User' })
    const denied = (promise, code) => assert.rejects(promise, error => error.code === code)
    assert.equal(await getRegistrationMode(), 'OPEN')
    await createRegisteredUser(user('open'))
    await mode('CLOSED')
    upgrade()
    assert.equal(await getRegistrationMode(), 'CLOSED')
    await denied(createRegisteredUser(user('closed')), 'registrationClosed')
    await invite('closed-code')
    await denied(createRegisteredUser(user('closed-code'), 'closed-code'), 'registrationClosed')
    await mode('INVITE_ONLY')
    await denied(createRegisteredUser(user('missing')), 'invalidInvite')
    await denied(createRegisteredUser(user('invalid'), 'invalid'), 'invalidInvite')
    await invite('expired', { expiresAt: new Date(0) })
    await invite('revoked', { revokedAt: new Date() })
    await denied(createRegisteredUser(user('expired'), 'expired'), 'invalidInvite')
    await denied(createRegisteredUser(user('revoked'), 'revoked'), 'invalidInvite')
    await invite('single-use')
    const concurrent = await Promise.allSettled([
      createRegisteredUser(user('race1'), 'single-use'),
      createRegisteredUser(user('race2'), 'single-use'),
    ])
    assert.equal(concurrent.filter(result => result.status === 'fulfilled').length, 1)
    assert.equal(concurrent.find(result => result.status === 'rejected').reason.code, 'invalidInvite')
    await invite('rollback')
    await denied(createRegisteredUser(user('open'), 'rollback'), 'P2002')
    assert.equal((await db.registrationInvite.findUnique({ where: { codeHash: hashInvite('rollback') } })).usedAt, null)
    await createRegisteredUser(user('after-rollback'), '  rollback  ')
    await invite('not-consumed')
    await mode('OPEN')
    await createRegisteredUser(user('open-with-code'), 'not-consumed')
    assert.equal((await db.registrationInvite.findUnique({ where: { codeHash: hashInvite('not-consumed') } })).usedAt, null)

    const { POST: register } = load('src/app/api/auth/register/route.ts')
    const request = body => new Request('http://localhost/api/admin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const registerBody = { name: 'API User', email: 'api@example.test', password: 'test-password', isAdmin: true, isOwner: true, role: 'ADMIN' }
    assert.equal((await register(request(registerBody))).status, 201)
    assert.equal((await db.user.findUnique({ where: { email: registerBody.email } })).isAdmin, false)
    assert.equal((await db.user.findUnique({ where: { email: registerBody.email } })).isOwner, false)
    assert.equal((await register(request(registerBody))).status, 409)
    assert.equal((await register(request({}))).status, 400)
    await mode('CLOSED')
    assert.equal((await register(request({ ...registerBody, email: 'blocked@example.test' }))).status, 403)

    const { POST: admin } = load('src/app/api/admin/route.ts')
    assert.equal((await admin(request({ action: 'mode', mode: 'OPEN' }))).status, 403)
    session = { user: { id: existing.id } }
    assert.equal((await admin(request({ action: 'invite', days: 7 }))).status, 403)
    const { PUT: profile } = load('src/app/api/user/profile/route.ts')
    assert.equal((await profile(request({ name: 'Existing User', role: 'ADMIN', isAdmin: true, isOwner: true }))).status, 200)
    assert.equal((await admin(request({ action: 'mode', mode: 'OPEN' }))).status, 403)
    await db.user.update({ where: { id: existing.id }, data: { isAdmin: true } })
    assert.equal((await admin(request({ action: 'mode', mode: 'INVALID' }))).status, 400)
    assert.equal((await admin(request({ action: 'invite', days: 0 }))).status, 400)
    assert.equal((await admin(request({ action: 'invite', days: 91 }))).status, 400)
    assert.equal((await admin(new Request('http://localhost/api/admin', { method: 'POST', body: '{}' }))).status, 415)
    assert.equal((await admin(request({ action: 'mode', mode: 'INVITE_ONLY' }))).status, 200)
    const created = await admin(request({ action: 'invite', days: 7 }))
    assert.equal(created.status, 201)
    const { code } = await created.json()
    assert.equal(code.length, 32)
    const stored = await db.registrationInvite.findUnique({ where: { codeHash: hashInvite(code) } })
    assert.ok(stored)
    assert.equal((await admin(request({ action: 'revoke', id: stored.id }))).status, 200)
    await denied(createRegisteredUser(user('api-revoked'), code), 'invalidInvite')
    const { code: apiCode } = await (await admin(request({ action: 'invite', days: 1 }))).json()
    assert.equal((await register(request({ ...registerBody, email: 'invited-api@example.test', inviteCode: apiCode }))).status, 201)
    assert.equal((await register(request({ ...registerBody, email: 'reused-api@example.test', inviteCode: apiCode }))).status, 403)
    await db.user.update({ where: { id: existing.id }, data: { isAdmin: false } })
    assert.equal((await admin(request({ action: 'mode', mode: 'OPEN' }))).status, 403)

    let config
    load('src/auth.ts', {
      'next-auth': value => { config = value; return {} },
      '@auth/prisma-adapter': { PrismaAdapter: () => ({}) },
      'next-auth/providers/google': value => value,
      'next-auth/providers/credentials': value => value,
    })
    const account = { type: 'oauth', provider: 'google', providerAccountId: 'synthetic-google' }
    assert.equal(await config.callbacks.signIn({ account }), '/login?error=oauthInviteRequired')
    await denied(config.adapter.createUser(user('oauth-invite')), 'invalidInvite')
    await mode('CLOSED')
    assert.equal(await config.callbacks.signIn({ account }), '/login?error=registrationClosed')
    await denied(config.adapter.createUser(user('oauth-closed')), 'registrationClosed')
    await db.account.create({ data: { ...account, userId: existing.id } })
    assert.equal(await config.callbacks.signIn({ account }), true)
    assert.equal(await config.callbacks.signIn({ account: { type: 'credentials' } }), true)
    assert.equal((await config.providers[1].authorize({ email: existing.email, password: 'test-password' })).id, existing.id)
    await mode('OPEN')
    assert.equal(await config.callbacks.signIn({ account: { ...account, providerAccountId: 'new-google' } }), true)
    assert.ok((await config.adapter.createUser(user('oauth-open'))).id)
    // A Google-created first account follows the same owner bootstrap.
    await db.user.deleteMany()
    const googleOwner = await config.adapter.createUser(user('google-owner'))
    assert.equal(googleOwner.isAdmin, true)
    assert.equal(googleOwner.isOwner, true)
    const googleMember = await config.adapter.createUser({ ...user('google-member'), isAdmin: true, isOwner: true })
    assert.equal(googleMember.isAdmin, false)
    assert.equal(googleMember.isOwner, false)
    console.log('PASS: first-user owner concurrency, OAuth bootstrap, admin grant/revoke and owner protection; additive/repeatable upgrade; all registration modes; invite expiry, revocation, rollback and concurrency; API validation; admin/profile isolation; immediate admin revocation; OAuth creation guard and existing-account login.')
  } finally {
    await db.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`)
    await db.$disconnect()
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
