// Real PostgreSQL and Auth.js OIDC validation; only the identity provider is synthetic.
const assert = require('node:assert/strict')
const { randomUUID, createHash } = require('node:crypto')
const { readFileSync } = require('node:fs')
const { resolve } = require('node:path')
const { pathToFileURL } = require('node:url')
const { execFileSync } = require('node:child_process')
const { createServer } = require('node:http')
const Module = require('node:module')
const ts = require('typescript')
const { PrismaClient } = require('@prisma/client')

async function main() {
  const url = new URL(process.env.TEST_DATABASE_URL || 'invalid:')
  assert.match(url.protocol, /^postgres(ql)?:$/)
  assert.match(url.pathname, /_test$/)
  if (process.env.DATABASE_URL) {
    const live = new URL(process.env.DATABASE_URL)
    assert.notEqual(url.host + url.pathname, live.host + live.pathname)
  }
  const schema = `pocket_test_${randomUUID().replaceAll('-', '')}`
  url.searchParams.set('schema', schema)
  const db = new PrismaClient({ datasources: { db: { url: url.toString() } } })
  process.env.AUTH_SECRET = 'synthetic-pocket-id-encryption-secret'
  process.env.AUTH_URL = 'http://localhost:3000'
  process.env.NODE_ENV = 'development'
  const { PrismaAdapter } = await import('@auth/prisma-adapter')
  const { default: Google } = await import('next-auth/providers/google')
  const { default: Credentials } = await import('next-auth/providers/credentials')
  const core = resolve(require.resolve('next-auth'), '../node_modules/@auth/core/index.js')
  const { Auth } = await import(pathToFileURL(core))
  const jose = await import('jose')
  const { generateKeyPair, exportJWK, SignJWT } = jose
  const keys = await generateKeyPair('RS256')
  const jwk = { ...await exportJWK(keys.publicKey), kid: 'synthetic', alg: 'RS256', use: 'sig' }
  let admin = null, configFactory, issuer, tokenIdentity, tokenNonce, expectedChallenge, badToken = false, badDiscovery = false
  const cache = new Map()
  function load(file) {
    const path = resolve(file)
    if (cache.has(path)) return cache.get(path).exports
    const mod = new Module(path, module)
    mod.filename = path; mod.paths = module.paths
    mod.require = id => {
      if (id === 'jose') return jose
      if (id === '@/lib/prisma') return { __esModule: true, default: db }
      if (id === '@/lib/admin') return { getAdmin: async () => admin }
      if (id === 'next-auth') return { __esModule: true, default: factory => { configFactory = factory; return {} } }
      if (id === '@auth/prisma-adapter') return { PrismaAdapter }
      if (id === 'next-auth/providers/google') return { __esModule: true, default: Google }
      if (id === 'next-auth/providers/credentials') return { __esModule: true, default: Credentials }
      if (id.startsWith('@/')) return load(`src/${id.slice(2)}.ts`)
      return require(id)
    }
    cache.set(path, mod)
    mod._compile(ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, path)
    return mod.exports
  }
  const server = createServer(async (req, res) => {
    try {
      res.setHeader('content-type', 'application/json')
      if (req.url === '/.well-known/openid-configuration') return res.end(JSON.stringify({
        issuer: badDiscovery ? 'https://wrong.example' : issuer,
        authorization_endpoint: `${issuer}/authorize`, token_endpoint: `${issuer}/token`,
        userinfo_endpoint: `${issuer}/userinfo`, jwks_uri: `${issuer}/jwks`,
        response_types_supported: ['code'], subject_types_supported: ['public'],
        id_token_signing_alg_values_supported: ['RS256'], code_challenge_methods_supported: ['S256'],
        token_endpoint_auth_methods_supported: ['client_secret_basic'],
      }))
      if (req.url === '/jwks') return res.end(JSON.stringify({ keys: [jwk] }))
      if (req.url === '/token') {
        let body = ''; for await (const chunk of req) body += chunk
        const params = new URLSearchParams(body)
        assert.equal(createHash('sha256').update(params.get('code_verifier')).digest('base64url'), expectedChallenge)
        assert.equal(req.headers.authorization, `Basic ${Buffer.from('synthetic-client:synthetic-secret').toString('base64')}`)
        let token = await new SignJWT({ ...tokenIdentity, nonce: tokenNonce }).setProtectedHeader({ alg: 'RS256', kid: 'synthetic' }).setIssuer(issuer).setAudience('synthetic-client').setIssuedAt().setExpirationTime('5m').sign(keys.privateKey)
        if (badToken) token = token.slice(0, -12) + 'invalidtoken'
        return res.end(JSON.stringify({ access_token: 'synthetic-access', token_type: 'Bearer', id_token: token }))
      }
      res.statusCode = 404; res.end('{}')
    } catch (error) { res.statusCode = 500; res.end('{}'); console.error(error) }
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  issuer = `http://127.0.0.1:${server.address().port}`
  const identity = (sub, email = `${sub}@example.test`) => ({ sub, email, email_verified: true, name: sub })
  const settings = { enabled: true, issuer, clientId: 'synthetic-client', clientSecret: 'synthetic-secret' }
  try {
    execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], { env: { ...process.env, DATABASE_URL: url.toString() }, stdio: 'pipe' })
    const lib = load('src/lib/pocket-id.ts')
    const api = load('src/app/api/admin/pocket-id/route.ts')
    load('src/auth.ts')
    assert.equal(await lib.getPocketIdConfig(), null)
    assert.equal((await configFactory()).providers.some(p => p.id === 'pocket-id'), false)
    const request = (body, origin = process.env.AUTH_URL, type = 'application/json') => new Request(`${process.env.AUTH_URL}/api/admin/pocket-id`, { method: 'PATCH', headers: { Origin: origin, 'Content-Type': type }, body: JSON.stringify(body) })
    assert.equal((await api.GET()).status, 403)
    assert.equal((await api.PATCH(request(settings))).status, 403)
    admin = { id: 'admin' }
    assert.equal((await api.PATCH(request(settings, 'https://attacker.example'))).status, 403)
    assert.equal((await api.PATCH(request(settings, process.env.AUTH_URL, 'text/plain'))).status, 415)
    assert.equal((await api.PATCH(request({ ...settings, clientSecret: '' }))).status, 400)
    assert.equal((await api.PATCH(request(settings))).status, 200)
    let config = await lib.getPocketIdConfig()
    assert.equal(config.secret, 'synthetic-secret')
    assert.ok(!config.clientSecret.includes('synthetic-secret'))
    assert.notEqual(lib.encryptPocketIdSecret('x'), lib.encryptPocketIdSecret('x'))
    const publicSettings = await (await api.GET()).json()
    assert.equal(publicSettings.hasClientSecret, true)
    assert.ok(!JSON.stringify(publicSettings).includes(config.clientSecret))
    assert.ok(!JSON.stringify(publicSettings).includes(config.secret))
    await lib.savePocketIdSettings({ ...settings, clientSecret: '' })
    assert.equal((await lib.getPocketIdConfig()).clientSecret, config.clientSecret)
    await lib.checkPocketIdDiscovery(issuer)
    badDiscovery = true
    await assert.rejects(lib.checkPocketIdDiscovery(issuer), e => e.code === 'discoveryFailed')
    badDiscovery = false
    process.env.NODE_ENV = 'production'
    assert.throws(() => lib.pocketIdUrl(issuer), e => e.code === 'invalidIssuer')
    assert.equal(lib.pocketIdUrl('https://id.internal/'), 'https://id.internal')
    process.env.NODE_ENV = 'development'
    for (const invalid of ['https://user:secret@id.example', 'file:///etc/passwd', 'https://id.example?x=1']) assert.throws(() => lib.pocketIdUrl(invalid))

    const cookies = new Map()
    async function authRequest(path, options = {}) {
      const cfg = await configFactory()
      const response = await Auth(new Request(process.env.AUTH_URL + '/api/auth' + path, {
        ...options, headers: { cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join('; '), ...options.headers },
      }), { ...cfg, secret: process.env.AUTH_SECRET, trustHost: true, basePath: '/api/auth', logger: { error() {}, warn() {}, debug() {} } })
      for (const cookie of response.headers.getSetCookie()) {
        const pair = cookie.split(';')[0], index = pair.indexOf('=')
        cookies.set(pair.slice(0, index), pair.slice(index + 1))
      }
      return response
    }
    async function login(profile, failure) {
      cookies.clear()
      const csrf = await (await authRequest('/csrf')).json()
      const started = await authRequest('/signin/pocket-id', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ csrfToken: csrf.csrfToken, callbackUrl: '/dashboard' }) })
      const authorization = new URL(started.headers.get('location'))
      assert.equal(authorization.origin, issuer)
      expectedChallenge = authorization.searchParams.get('code_challenge')
      tokenNonce = authorization.searchParams.get('nonce')
      assert.ok(expectedChallenge && tokenNonce && authorization.searchParams.get('state'))
      tokenIdentity = profile
      if (failure === 'nonce') tokenNonce = 'wrong-nonce'
      badToken = failure === 'signature'
      const state = failure === 'state' ? 'wrong-state' : authorization.searchParams.get('state')
      const response = await authRequest('/callback/pocket-id?' + new URLSearchParams({ code: 'synthetic-code', state }))
      badToken = false
      const session = await (await authRequest('/session')).json()
      return { response, session }
    }
    for (const mode of ['OPEN', 'CLOSED', 'INVITE_ONLY']) {
      await db.registrationSettings.upsert({ where: { id: 'global' }, create: { id: 'global', mode }, update: { mode } })
      const result = await login(identity(mode))
      assert.ok(result.session.user?.id, result.response.headers.get('location'))
      const user = await db.user.findUnique({ where: { id: result.session.user.id } })
      assert.equal(user.isAdmin, false); assert.equal(user.isOwner, false)
    }
    const owner = await db.user.create({ data: { email: 'Owner@Example.test', name: 'Keep local name', isAdmin: true, isOwner: true } })
    const project = await db.project.create({ data: { name: 'Preserve', ownerId: owner.id, shortCode: randomUUID() } })
    const linked = await login(identity('owner', 'owner@example.test'))
    assert.equal(linked.session.user.id, owner.id)
    assert.equal((await db.user.findUnique({ where: { id: owner.id } })).name, 'Keep local name')
    assert.equal((await db.project.findUnique({ where: { id: project.id } })).ownerId, owner.id)
    assert.equal((await login(identity('owner', 'changed@example.test'))).session.user.id, owner.id)
    assert.ok(!(await login(identity('other-owner', 'owner@example.test'))).session?.user)
    await db.user.create({ data: { email: 'OWNER@example.test' } })
    assert.ok(!(await login(identity('ambiguous', 'owner@example.test'))).session?.user)
    for (const failure of ['signature', 'nonce', 'state']) {
      assert.ok(!(await login(identity(`invalid-${failure}`), failure)).session?.user)
      assert.equal(await db.user.count({ where: { email: `invalid-${failure}@example.test` } }), 0)
    }
    for (const email_verified of [false, undefined]) assert.ok(!(await login({ ...identity('unverified'), email_verified })).session?.user)
    assert.equal(await db.user.count({ where: { email: 'unverified@example.test' } }), 0)
    const concurrent = await Promise.all(Array.from({ length: 4 }, () => lib.provisionPocketIdAccount(identity('parallel'), config)))
    assert.equal(new Set(concurrent.map(u => u.id)).size, 1)
    assert.equal(await db.account.count({ where: { providerAccountId: 'parallel' } }), 1)
    await assert.rejects(lib.savePocketIdSettings({ ...settings, issuer: 'https://different.example' }), e => e.code === 'issuerLocked')
    await login(identity('owner', 'owner@example.test'))
    await lib.savePocketIdSettings({ ...settings, enabled: false, clientSecret: '' })
    assert.equal(await lib.getPocketIdConfig(), null)
    await assert.rejects(lib.provisionPocketIdAccount(identity('disabled'), config), e => e.code === 'configurationChanged')
    assert.ok((await (await authRequest('/session')).json()).user, 'Existing session survives provider disablement')
    await lib.savePocketIdSettings(settings)
    process.env.AUTH_SECRET = 'rotated-secret'
    assert.equal(await lib.getPocketIdConfig(), null)
    assert.ok(!(await configFactory()).providers.some(p => p.id === 'pocket-id'))
    await lib.savePocketIdSettings({ ...settings, enabled: false, clientSecret: '' })
    await lib.savePocketIdSettings(settings)
    assert.equal((await lib.getPocketIdConfig()).secret, settings.clientSecret)
    const { authReturnPath } = load('src/lib/auth-return-path.ts')
    assert.equal(authReturnPath('https://attacker.example'), '/dashboard')
    assert.equal(authReturnPath('/project/123'), '/project/123')
    const de = JSON.parse(readFileSync('src/dictionaries/de.json')).pocketId
    const en = JSON.parse(readFileSync('src/dictionaries/en.json')).pocketId
    assert.deepEqual(Object.keys(de).sort(), Object.keys(en).sort())
    console.log('PASS: admin security, encryption/rotation, discovery, real Auth.js OIDC/PKCE/state/nonce/signature, verified-email linking, conflicts, concurrent provisioning, registration policies and disablement.')
  } finally {
    await new Promise(resolve => server.close(resolve))
    await db.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`)
    await db.$disconnect()
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
