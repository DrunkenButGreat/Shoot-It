// Offline checks for dependency security upgrades; no application database or SMTP server.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')
const { NextRequest } = require('next/server')
const root = path.resolve(__dirname, '..')
function load(file, overrides = {}) {
  const cache = new Map()
  function inner(file) {
    const filename = ['', '.ts', '.json'].map(ext => path.resolve(root, file + ext)).find(fs.existsSync)
    assert.ok(filename, `Missing module: ${file}`)
    if (filename.endsWith('.json')) return JSON.parse(fs.readFileSync(filename, 'utf8'))
    if (cache.has(filename)) return cache.get(filename).exports
    const mod = new Module(filename, module)
    mod.filename = filename
    mod.paths = module.paths
    mod.require = id => Object.hasOwn(overrides, id) ? overrides[id] : id.startsWith('@/') ? inner('src/' + id.slice(2)) : id.startsWith('.') ? inner(path.resolve(path.dirname(filename), id)) : require(id)
    cache.set(filename, mod)
    mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, filename)
    return mod.exports
  }
  return inner(file)
}
const request = body => new NextRequest('http://localhost/test', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
async function validation() {
  const schemas = load('src/lib/validations.ts')
  const fixtures = {
    projectSchema: { name: 'Synthetic project', date: '2026-11-01T10:00:00Z', location: null, isPublic: false },
    participantSchema: { name: 'Ada', email: '' },
    contractSchema: { title: 'Agreement', content: 'Synthetic content' },
    signatureSchema: { signature: 'data:image/png;base64,AA==', name: 'Ada', email: 'ada@example.test' },
    ratingSchema: { stars: 5, color: 'RED', guestId: 'guest' },
    callsheetSchema: { callTime: '2026-11-01T10:00:00Z', weatherInfo: 'Sunny' },
    moodboardGroupSchema: { name: 'Reference', isFavorite: false },
    commentSchema: { content: 'Synthetic comment' },
    scheduleItemSchema: { time: '2026-11-01T10:00:00Z', activity: 'Setup' },
    resultFolderSchema: { name: 'Finals', parentId: null },
    selectionFolderSchema: { name: 'Selects', parentId: null },
    registerSchema: { name: 'Ada', email: 'ada@example.test', password: 'synthetic', inviteCode: '  invite  ' },
  }
  for (const [name, fixture] of Object.entries(fixtures)) {
    const result = schemas[name].safeParse({ ...fixture, unknownField: true })
    assert.equal(result.success, true, name)
    assert.equal(result.data.unknownField, undefined, `${name} must still strip unknown keys`)
    assert.equal(schemas[name].safeParse(null).success, false, name)
  }
  assert.equal(schemas.registerSchema.parse(fixtures.registerSchema).inviteCode, 'invite')
  assert.equal(schemas.scheduleItemSchema.parse(fixtures.scheduleItemSchema).order, 0)
  assert.equal(schemas.projectSchema.safeParse({ name: 'Project', date: '2026-11-01' }).success, false)
  assert.equal(schemas.ratingSchema.safeParse({ stars: 6 }).success, false)
  assert.equal(schemas.participantSchema.safeParse({ name: 'Ada', email: 'not-an-email' }).success, false)
  const oversized = require('zod').z.array(require('zod').z.string()).max(2).safeParse(Array(10000).fill(42))
  assert.equal(oversized.success, false)
  assert.equal(oversized.error.issues.length, 1, 'Reject oversized constrained arrays before accumulating per-element issues')
  let writes = 0
  const db = {
    user: { update: async ({ data }) => { writes++; assert.equal(data.isAdmin, undefined); return data } },
    participant: { updateMany: async () => ({ count: 0 }) },
    moodboardGroup: { create: async ({ data }) => { writes++; assert.equal(data.isLibrary, true); return data } },
  }
  for (const [file, method, valid] of [
    ['src/app/api/user/profile/route.ts', 'PUT', { name: 'Ada', isAdmin: true }],
    ['src/app/api/user/moodboards/route.ts', 'POST', { name: 'References' }],
  ]) {
    const route = load(file, { '@/auth': { auth: async () => ({ user: { id: 'synthetic-user' } }) }, '@/lib/prisma': db })
    const response = await route[method](request({ name: '' }))
    assert.equal(response.status, 400)
    const error = await response.json()
    assert.equal(error.error, 'Invalid input data')
    assert.equal(Array.isArray(error.details), true)
    assert.deepEqual(error.details[0].path, ['name'])
    assert.equal((await route[method](request(valid))).status, method === 'PUT' ? 200 : 201)
  }
  assert.equal(writes, 2, 'Invalid payloads must never reach persistence')
}
async function mail() {
  const nodemailer = require('nodemailer')
  const stream = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: 'unix' })
  const message = { from: 'Synthetic App <app@example.test>', to: '"Ada; Example" <ada@example.test>', subject: 'Offline compatibility', text: 'Synthetic plain text', html: '<p>Synthetic HTML</p>' }
  const rendered = await stream.sendMail(message)
  assert.deepEqual(rendered.envelope.to, ['ada@example.test'])
  assert.ok(Buffer.isBuffer(rendered.message))
  assert.match(rendered.message.toString(), /Synthetic plain text/)
  assert.match(rendered.message.toString(), /Synthetic HTML/)
  const json = nodemailer.createTransport({ jsonTransport: true })
  const serialized = JSON.parse((await json.sendMail(message)).message)
  assert.equal(serialized.to[0].address, 'ada@example.test')
  assert.equal(serialized.subject, message.subject)
  assert.equal(serialized.text, message.text)
  const names = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM']
  const old = Object.fromEntries(names.map(name => [name, process.env[name]]))
  try {
    process.env.SMTP_HOST = 'offline.invalid'
    process.env.SMTP_USER = 'synthetic-user'
    process.env.SMTP_PASS = 'synthetic-password'
    process.env.SMTP_FROM = message.from
    const { sendMail } = load('src/lib/mail.ts', { nodemailer: {
      createTransport: options => { assert.equal(options.host, 'offline.invalid'); return json },
    } })
    assert.equal((await sendMail({ to: message.to, subject: message.subject, html: message.html, text: message.text })).success, true)
  } finally {
    for (const name of names) { if (old[name] === undefined) delete process.env[name]; else process.env[name] = old[name] }
    stream.close(); json.close()
  }
}
async function archive(tmp) {
  const source = path.join(tmp, 'original.jpg')
  const content = Buffer.from([0, 255, 1, 254, 2, 253])
  fs.writeFileSync(source, content)
  const { archiveResponse } = load('src/lib/zip.ts')
  const response = archiveResponse([{ fullPath: source, name: 'Photos/original.jpg' }, { fullPath: path.join(tmp, 'missing'), name: 'missing.jpg' }], 'synthetic.zip')
  assert.equal(response.headers.get('Content-Type'), 'application/zip')
  const zip = Buffer.from(await response.arrayBuffer())
  const end = zip.length - 22
  assert.equal(zip.readUInt32LE(end), 0x06054b50, 'ZIP end record')
  assert.equal(zip.readUInt16LE(end + 10), 1, 'ZIP has one central-directory entry')
  const central = zip.readUInt32LE(end + 16)
  assert.equal(zip.readUInt32LE(central), 0x02014b50, 'ZIP central-directory signature')
  assert.equal(zip.readUInt16LE(central + 10), 0, 'Original image is stored without recompression')
  const length = zip.readUInt32LE(central + 24)
  const nameLength = zip.readUInt16LE(central + 28)
  assert.equal(zip.subarray(central + 46, central + 46 + nameLength).toString(), 'Photos/original.jpg')
  const local = zip.readUInt32LE(central + 42)
  assert.equal(zip.readUInt32LE(local), 0x04034b50, 'ZIP local-file signature')
  const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28)
  assert.deepEqual(zip.subarray(start, start + length), content, 'ZIP contains original image bytes')
  // Exercise the overridden CJS APIs even though archiveResponse only appends explicit files.
  const glob = require(require.resolve('glob', { paths: [path.dirname(require.resolve('archiver-utils'))] }))
  assert.deepEqual(glob.sync('*.jpg', { cwd: tmp }), ['original.jpg'])
  const minimatch = require(require.resolve('minimatch', { paths: [path.dirname(require.resolve('readdir-glob'))] }))
  assert.equal(new minimatch.Minimatch('Photos/**/*.jpg').match('Photos/original.jpg'), true)
}
async function prismaConfig(tmp) {
  const { createRequire } = Module
  const configRequire = createRequire(require.resolve('@prisma/config'))
  const merge = await import(require('node:url').pathToFileURL(configRequire.resolve('deepmerge-ts')).href)
  assert.deepEqual(merge.deepmerge({ migrations: { path: './prisma/migrations' } }, { schema: './prisma/schema.prisma' }), { migrations: { path: './prisma/migrations' }, schema: './prisma/schema.prisma' })
  fs.writeFileSync(path.join(tmp, 'prisma.config.js'), "module.exports = { schema: './prisma/schema.prisma' }\n")
  const { loadConfigFromFile } = require('@prisma/config')
  const result = await loadConfigFromFile({ configRoot: tmp })
  assert.equal(result.error, undefined)
  assert.equal(result.resolvedPath, path.join(tmp, 'prisma.config.js'))
  assert.equal(result.config.schema, path.join(tmp, 'prisma/schema.prisma'))
}
;(async () => {
  const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'shootit-dependency-compat-')))
  try { await validation(); await mail(); await archive(tmp); await prismaConfig(tmp) }
  finally { fs.rmSync(tmp, { recursive: true, force: true }) }
  console.log('PASS: Zod schema/error contracts and constrained arrays; Nodemailer offline stream/JSON transports; original ZIP bytes, glob/minimatch APIs; Prisma config/deepmerge compatibility. No mail sent or database accessed.')
})().catch(error => { console.error(error); process.exitCode = 1 })
