// Exercise production handlers with synthetic data and an isolated upload directory.
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
    const filename = ['', '.ts', '.tsx'].map(ext => path.resolve(root, file + ext)).find(fs.existsSync)
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
const ctx = extra => ({ params: Promise.resolve({ id: 'project-a', ...extra }) })
const req = (body = {}, headers) => new NextRequest('http://localhost/test', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) })
const member = { user: { id: 'member' } }
const base = {
  '@/auth': { auth: async () => member },
  '@/lib/permissions': { canAccessProject: async () => true, canEditProject: async () => true },
}
async function handlers() {
  let where
  let route = load('src/app/api/projects/route.ts', { ...base, '@/lib/prisma': { project: {
    findMany: async q => (where = q.where, []), count: async () => 0,
  } } })
  assert.equal((await route.GET(new NextRequest('http://localhost/api/projects?search=secret'))).status, 200)
  assert.equal(where.AND[0].OR[0].ownerId, 'member')
  assert.equal(where.AND[1].OR[0].name.contains, 'secret')

  route = load('src/app/api/projects/[id]/contracts/[contractId]/route.ts', {
    ...base, '@/lib/permissions': { canAccessProject: async () => false }, '@/lib/prisma': {},
  })
  assert.equal((await route.GET(req(), ctx({ contractId: 'foreign' }))).status, 403)
  route = load('src/app/api/projects/[id]/contracts/[contractId]/route.ts', {
    ...base, '@/lib/prisma': { contract: { findUnique: async q => { assert.equal(q.where.projectId, 'project-a'); return null } } },
  })
  assert.equal((await route.GET(req(), ctx({ contractId: 'foreign' }))).status, 404)
  for (const [url, child, model] of [['contracts/[contractId]/sign', 'contractId', 'contract'], ['appointments/[slotId]/respond', 'slotId', 'appointmentSlot']]) {
    route = load(`src/app/api/projects/[id]/${url}/route.ts`, { ...base, '@/lib/prisma': {
      [model]: { findUnique: async q => { assert.equal(q.where.projectId, 'project-a'); return null } },
    } })
    assert.equal((await route.POST(req({}), ctx({ [child]: 'foreign' }))).status, 404)
  }
  for (const [url, methods] of [['moodboard/groups/[groupId]', ['PUT', 'DELETE']], ['moodboard/groups/[groupId]/images', ['POST']], ['moodboard/groups/[groupId]/scan', ['POST']]]) {
    route = load(`src/app/api/projects/[id]/${url}/route.ts`, { ...base, '@/lib/prisma': {
      projectMoodboardLink: { findUnique: async q => {
        assert.deepEqual(q.where.projectId_groupId, { projectId: 'project-a', groupId: 'foreign' }); return null
      } },
    } })
    for (const method of methods) assert.equal((await route[method](req(), ctx({ groupId: 'foreign' }))).status, 404)
  }
  for (const kind of ['selection', 'results']) {
    const db = { project: { findUnique: async () => ({ isPublic: true, showSelectionPublicly: true, allowSelectionDownload: true, showResultsPublicly: true }) } }
    db[kind === 'selection' ? 'selectionFolder' : 'resultFolder'] = { findMany: async () => [
      { id: 'parent', name: 'Parent', parentId: null }, { id: 'child', name: 'Child', parentId: 'parent' },
    ] }
    db[kind === 'selection' ? 'selectionImage' : 'resultFile'] = { findMany: async q => {
      assert.equal(q.where.projectId, 'project-a')
      assert.deepEqual(new Set(q.where.OR[1].folderId.in), new Set(['parent', 'child']))
      return [{ id: 'own', folderId: 'child', filename: 'own.jpg', path: '/api/uploads/own.jpg' }]
    } }
    route = load(`src/app/api/projects/[id]/${kind}/download/route.ts`, { ...base, '@/auth': { auth: async () => null }, '@/lib/prisma': db })
    const result = await route.POST(req({ imageIds: ['foreign'], folderIds: ['parent', 'foreign-folder'], mode: 'manifest' }), ctx())
    assert.equal(result.status, 200)
    assert.deepEqual((await result.json()).files, [{ url: '/api/uploads/own.jpg', relativePath: 'Parent/Child/own.jpg' }])
  }
  for (const flags of [{ isPublic: false, showSelectionPublicly: true }, { isPublic: true, showSelectionPublicly: false }]) {
    route = load('src/app/api/projects/[id]/selection/[imageId]/rating/route.ts', {
      ...base, '@/auth': { auth: async () => null }, '@/lib/prisma': { project: { findUnique: async () => ({ ...flags, allowGuestSelection: true }) } },
    })
    assert.equal((await route.PUT(req({ stars: 5, guestId: 'guest' }), ctx({ imageId: 'image' }))).status, 401)
  }
  route = load('src/proxy.ts', { '@/auth': { auth: async fn => fn } })
  for (const pathname of ['/', '/login', '/signup', '/p/share', '/api/auth/callback/google', '/images/design/coastal-editorial.webp', '/robots.txt']) {
    assert.equal((await route.proxy({ nextUrl: new URL(`http://localhost${pathname}`), url: `http://localhost${pathname}`, auth: null })).headers.get('x-middleware-next'), '1')
  }
  for (const pathname of ['/project/private', '/images-private/secret', '/robots.txt-private', '/images/../project/private']) {
    assert.equal((await route.proxy({ nextUrl: new URL(`http://localhost${pathname}`), url: `http://localhost${pathname}`, auth: null })).status, 307)
  }
}
async function policy() {
  let project = { id: 'project-a', ownerId: 'owner', isPublic: false, showMoodboardPublicly: true, showSelectionPublicly: true, showResultsPublicly: true, showParticipantsPublicly: true, allowSelectionDownload: false }
  const asset = '/api/uploads/selection/project-a/photo.jpg'
  let record = true
  const db = {
    selectionImage: { findFirst: async q => { assert.equal(q.where.OR[0].path, asset); return record ? { path: asset, project } : null } },
    resultFile: { findFirst: async () => record ? { project } : null },
    moodboardImage: { findFirst: async () => record ? { group: { ownerId: 'library-owner', projectLinks: [{ project }] } } : null },
    participantImage: { findFirst: async () => ({ participant: { project } }) },
    applicationImage: { findFirst: async () => ({ application: { userId: 'applicant', project: { ownerId: 'owner' } } }) },
    siteSettings: { findFirst: async q => q.where.OR.some(row => Object.values(row).includes('/api/uploads/site/current.webp')) ? { id: 'global' } : null },
    user: { findFirst: async () => ({ id: 'owner', image: null, brandingImage: '/api/uploads/users/owner/branding/current.webp' }) },
    project: { findMany: async () => [{ ...project, coverHidden: false, brandingImage: null }], findFirst: async () => project },
  }
  const { canReadUpload } = load('src/lib/upload-access.ts', { '@/lib/prisma': db, '@/lib/permissions': { canAccessProject: async user => user === 'member' } })
  const preview = '/api/uploads/selection/project-a/preview_photo.jpg.webp'
  assert.equal(await canReadUpload(asset), false)
  assert.equal(await canReadUpload(preview), false)
  assert.equal(await canReadUpload(asset, 'outsider'), false)
  assert.equal(await canReadUpload(asset, 'member'), true)
  project.isPublic = true
  assert.equal(await canReadUpload(preview), true)
  assert.equal(await canReadUpload(asset), false)
  project.allowSelectionDownload = true
  assert.equal(await canReadUpload(asset), true)
  project.showSelectionPublicly = false
  assert.equal(await canReadUpload(preview), false)
  assert.equal(await canReadUpload('/api/uploads/results/project-a/original.mp4'), true)
  assert.equal(await canReadUpload('/api/uploads/moodboard/user_library-owner/group/image.jpg'), true)
  project.isPublic = false
  assert.equal(await canReadUpload('/api/uploads/moodboard/old-project/group/image.jpg', 'member'), true)
  assert.equal(await canReadUpload('/api/uploads/moodboard/user_library-owner/group/image.jpg', 'library-owner'), true)
  assert.equal(await canReadUpload('/api/uploads/moodboard/user_library-owner/group/image.jpg'), false)
  assert.equal(await canReadUpload('/api/uploads/applications/project-a/app/image.jpg', 'member'), false)
  assert.equal(await canReadUpload('/api/uploads/applications/project-a/app/image.jpg', 'owner'), true)
  assert.equal(await canReadUpload('/api/uploads/applications/project-a/app/image.jpg', 'applicant'), true)
  assert.equal(await canReadUpload('/api/uploads/site/current.webp'), true)
  assert.equal(await canReadUpload('/api/uploads/site/old.webp'), false)
  assert.equal(await canReadUpload('/api/uploads/users/owner/branding/current.webp'), false)
  project.isPublic = true
  assert.equal(await canReadUpload('/api/uploads/users/owner/branding/current.webp'), true)
  assert.equal(await canReadUpload('/api/uploads/projects/project-a/participants/participant/image.jpg'), true)
  project.showParticipantsPublicly = false
  assert.equal(await canReadUpload('/api/uploads/projects/project-a/participants/participant/image.jpg'), false)
  record = false
  assert.equal(await canReadUpload(asset, 'member'), false)
  assert.equal(await canReadUpload('/api/uploads/arbitrary/file.jpg', 'member'), false)
}
async function files() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'shoot-it-security-'))
  const cwd = process.cwd()
  let allowed = false
  let generations = 0
  const route = load('src/app/api/uploads/[...path]/route.ts', {
    '@/auth': { auth: async () => null }, '@/lib/upload-access': { canReadUpload: async () => allowed },
    '@/lib/image-processing': { generateResultPreview: async (_source, dest) => { generations++; fs.writeFileSync(dest, 'preview') } },
  })
  const get = (parts, range) => route.GET(new NextRequest('http://localhost/api/uploads/' + parts.join('/'), { headers: range ? { range } : {} }), { params: Promise.resolve({ path: parts }) })
  try {
    process.chdir(tmp)
    // Authorization happens before filesystem access, even with no upload directory.
    assert.equal((await get(['selection', 'private.jpg'])).status, 403)
    fs.mkdirSync('uploads/selection', { recursive: true })
    fs.writeFileSync('uploads/selection/photo.jpg', '0123456789')
    fs.writeFileSync('secret.jpg', 'secret')
    fs.symlinkSync(path.join(tmp, 'secret.jpg'), 'uploads/selection/escape.jpg')
    fs.symlinkSync(tmp, 'uploads/escape')
    allowed = true
    for (const [range, status, body, contentRange] of [
      [null, 200, '0123456789', null], ['bytes=-3', 206, '789', 'bytes 7-9/10'],
      ['bytes=2-4', 206, '234', 'bytes 2-4/10'], ['bytes=7-', 206, '789', 'bytes 7-9/10'],
      ['bytes=8-90', 206, '89', 'bytes 8-9/10'], ['bytes=-50', 206, '0123456789', 'bytes 0-9/10'],
    ]) {
      const response = await get(['selection', 'photo.jpg'], range)
      assert.equal(response.status, status)
      assert.equal(await response.text(), body)
      assert.equal(response.headers.get('Content-Range'), contentRange)
      assert.equal(response.headers.get('Cache-Control'), 'private, no-store')
    }
    for (const range of ['bytes=-0', 'bytes=10-', 'bytes=3-2', 'bytes=-', 'bytes=0-1,3-4', 'garbage']) {
      assert.equal((await get(['selection', 'photo.jpg'], range)).status, 416)
    }
    assert.equal((await get(['selection', 'escape.jpg'])).status, 403)
    assert.equal((await get(['escape', 'preview_secret.jpg.webp'])).status, 403)
    assert.equal(generations, 0)
    assert.equal((await get(['..', 'secret.jpg'])).status, 403)
    const preview = await get(['selection', 'preview_photo.jpg.webp'])
    assert.equal(await preview.text(), 'preview')
    assert.equal(generations, 1)
    assert.equal((await get(['selection', 'missing.jpg'])).status, 404)
  } finally { process.chdir(cwd); fs.rmSync(tmp, { recursive: true, force: true }) }
}
async function localScan() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'shoot-it-local-scan-'))
  const cwd = process.cwd()
  const mediaRoot = path.join(tmp, 'local_media')
  const fsp = require('node:fs/promises')
  let reads = 0
  const created = []
  const db = {
    projectMoodboardLink: { findUnique: async () => ({ id: 'link' }) },
    moodboardGroup: { findUnique: async () => ({ ownerId: 'member', isLibrary: false }) },
    moodboardImage: {
      findFirst: async () => ({ order: 4 }),
      create: async ({ data }) => (created.push(data), data),
    },
  }
  const route = load('src/app/api/projects/[id]/moodboard/groups/[groupId]/scan/route.ts', {
    ...base, '@/lib/prisma': db,
    'fs/promises': {
      ...fsp,
      realpath: file => fsp.realpath(file === '/app/local_media' ? mediaRoot : file),
      readdir: (...args) => { reads++; return fsp.readdir(...args) },
    },
  })
  try {
    process.chdir(tmp)
    fs.mkdirSync(path.join(mediaRoot, 'shoot'), { recursive: true })
    fs.mkdirSync(path.join(tmp, 'local_media-private'))
    fs.writeFileSync(path.join(tmp, 'local_media-private', 'secret.jpg'), 'private')
    fs.symlinkSync(path.join(tmp, 'local_media-private'), path.join(mediaRoot, 'escape'))
    fs.symlinkSync(path.join(tmp, 'local_media-private', 'secret.jpg'), path.join(mediaRoot, 'shoot', 'linked-secret.jpg'))
    const sharp = require('sharp')
    await sharp({ create: { width: 3000, height: 1500, channels: 3, background: '#f05030' } }).jpeg().toFile(path.join(mediaRoot, 'shoot', 'portrait.jpg'))
    fs.writeFileSync(path.join(mediaRoot, 'shoot', 'notes.txt'), 'ignore')
    const result = await route.POST(req({ folderName: 'shoot' }), ctx({ groupId: 'group' }))
    assert.equal(result.status, 200)
    assert.deepEqual(await result.json(), { count: 1 })
    assert.equal(created.length, 1)
    const image = created[0]
    assert.match(image.path, /^\/api\/uploads\/moodboard\/project-a\/group\/[^/]+\.jpg$/)
    assert.equal(image.thumbnail, image.path.replace(/([^/]+)$/, 'preview_$1.webp'))
    assert.equal(image.order, 5)
    assert.equal(image.width, 3000)
    assert.equal(image.height, 1500)
    const diskPath = url => path.join(tmp, 'uploads', url.slice('/api/uploads/'.length))
    assert.deepEqual(fs.readFileSync(diskPath(image.path)), fs.readFileSync(path.join(mediaRoot, 'shoot', 'portrait.jpg')))
    const metadata = await sharp(diskPath(image.thumbnail)).metadata()
    assert.equal(metadata.format, 'webp')
    assert.equal(metadata.width, 2560)
    assert.equal(metadata.height, 1280)
    const readsBefore = reads
    for (const folderName of ['../local_media-private', 'escape', '.', '', null, 42, {}, []]) {
      assert.equal((await route.POST(req({ folderName }), ctx({ groupId: 'group' }))).status, 400)
    }
    assert.equal(reads, readsBefore, 'Rejected source paths must not be scanned')
    assert.equal(created.length, 1, 'Rejected source paths must not write database records')
  } finally { process.chdir(cwd); fs.rmSync(tmp, { recursive: true, force: true }) }
}
async function storage() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'shoot-it-storage-'))
  const cwd = process.cwd()
  const fsp = require('node:fs/promises')
  const actualNow = Date.now
  let now = 1000000
  let scans = 0
  let stats = 0
  let queries = 0
  const write = (name, bytes) => {
    const file = path.join(tmp, 'uploads', name)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, Buffer.alloc(bytes))
  }
  try {
    process.chdir(tmp)
    for (const [name, bytes] of [
      ['selection/a/photo.jpg', 2], ['results/a/photo.jpg', 3], ['applications/a/application/photo.jpg', 5],
      ['projects/a/branding/cover.webp', 7], ['projects/a/participants/portrait.jpg', 11],
      ['selection/b/photo.jpg', 13], ['results/b/photo.jpg', 17], ['applications/b/application/photo.jpg', 19], ['projects/b/branding/cover.webp', 23],
      ['moodboard/user_owner/group/photo.jpg', 29], ['moodboard/user_owner/group/preview_photo.jpg.webp', 31],
      ['selection/foreign/photo.jpg', 1000], ['moodboard/foreign/orphan.jpg', 1000],
      ['.startup-backups/database.dump', 1000], ['users/owner/branding/cover.webp', 1000], ['site/current.webp', 1000],
    ]) write(name, bytes)
    fs.writeFileSync(path.join(tmp, 'outside.jpg'), Buffer.alloc(1000))
    fs.symlinkSync(path.join(tmp, 'outside.jpg'), path.join(tmp, 'uploads', 'selection', 'a', 'symlink.jpg'))
    const shared = { path: '/api/uploads/moodboard/user_owner/group/photo.jpg', thumbnail: '/api/uploads/moodboard/user_owner/group/preview_photo.jpg.webp' }
    const { getStorageOverview } = load('src/lib/storage.ts', {
      '@/lib/prisma': { projectMoodboardLink: { findMany: async q => {
        queries++
        assert.deepEqual(q.where.projectId.in, ['a', 'b'])
        return ['a', 'b'].map(projectId => ({ projectId, group: { images: [shared, shared,
          { path: shared.path, thumbnail: shared.path },
          { path: '/api/uploads/moodboard/../.startup-backups/database.dump', thumbnail: null },
          { path: '/api/uploads/selection/foreign/photo.jpg', thumbnail: null },
        ] } }))
      } } },
      'fs/promises': { ...fsp,
        readdir: (...args) => { scans++; return fsp.readdir(...args) },
        stat: (...args) => { stats++; return fsp.stat(...args) },
      },
    })
    Date.now = () => now
    const result = await getStorageOverview(['b', 'a', 'a'])
    assert.deepEqual(result, { totalBytes: 160, projects: [{ projectId: 'a', bytes: 88 }, { projectId: 'b', bytes: 132 }] })
    assert.equal(queries, 1)
    assert.equal(stats, 11, 'Shared moodboard paths must be statted once across both projects')
    const before = { scans, stats, queries }
    write('selection/a/new.jpg', 2)
    now += 29999
    assert.equal(await getStorageOverview(['a', 'b']), result)
    assert.deepEqual({ scans, stats, queries }, before, 'Cache hits must not query or rescan disk')
    now += 2
    const refreshed = await getStorageOverview(['b', 'a'])
    assert.equal(refreshed.totalBytes, 162)
    assert.equal(queries, 2)
    assert.ok(stats > before.stats)
  } finally { Date.now = actualNow; process.chdir(cwd); fs.rmSync(tmp, { recursive: true, force: true }) }
}
;(async () => {
  await handlers(); await policy(); await files(); await localScan(); await storage()
  console.log('PASS: project/child isolation, scoped descendant downloads, public/guest visibility, DB-backed media policy, library sharing, branding, traversal/symlinks, streaming/byte ranges, local-scan previews/path boundaries and deduplicated cached storage accounting.')
})().catch(error => { console.error(error); process.exitCode = 1 })
