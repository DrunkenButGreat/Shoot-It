// Real PostgreSQL in a disposable schema; never touches application rows.
const assert = require('node:assert/strict')
const { randomUUID } = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')
const Module = require('node:module')
const ts = require('typescript')
const { PrismaClient } = require('@prisma/client')
const { NextRequest } = require('next/server')

async function main() {
  const url = new URL(process.env.TEST_DATABASE_URL || 'invalid:')
  assert.match(url.protocol, /^postgres(ql)?:$/)
  assert.match(url.pathname, /_test$/)
  if (process.env.DATABASE_URL) {
    const regular = new URL(process.env.DATABASE_URL)
    assert.notEqual(`${url.host}${url.pathname}`, `${regular.host}${regular.pathname}`)
  }
  const schema = `audit_test_${randomUUID().replaceAll('-', '')}`
  url.searchParams.set('schema', schema)
  const db = new PrismaClient({ datasources: { db: { url: url.toString() } } })
  let session = null
  const cache = new Map()
  function load(file) {
    const filename = ['', '.ts', '.json'].map(ext => path.resolve(file + ext)).find(fs.existsSync)
    assert.ok(filename, `Missing ${file}`)
    if (filename === path.resolve('src/lib/prisma.ts')) return { __esModule: true, default: db }
    if (filename.endsWith('.json')) return JSON.parse(fs.readFileSync(filename, 'utf8'))
    if (cache.has(filename)) return cache.get(filename).exports
    const mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths
    mod.require = id => id === '@/auth' ? { auth: async () => session }
      : id === '@/lib/prisma' ? { __esModule: true, default: db }
      : id.startsWith('@/') ? load(`src/${id.slice(2)}`)
      : id.startsWith('.') ? load(path.resolve(path.dirname(filename), id)) : require(id)
    cache.set(filename, mod)
    mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
    } }).outputText, filename)
    return mod.exports
  }
  let uploadDir, moodDir
  const params = (id, extra = {}) => ({ params: Promise.resolve({ id, ...extra }) })
  const request = body => new NextRequest('http://localhost/test', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  try {
    execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], { env: { ...process.env, DATABASE_URL: url.toString() }, stdio: 'pipe' })
    const owner = await db.user.create({ data: { email: `${schema}@example.test` } })
    const outsider = await db.user.create({ data: { email: `other-${schema}@example.test` } })
    const a = await db.project.create({ data: { name: 'A', shortCode: `${schema}-a`, ownerId: owner.id } })
    const b = await db.project.create({ data: { name: 'B', shortCode: `${schema}-b`, ownerId: outsider.id } })
    const { canAccessProject, canEditProject } = load('src/lib/permissions')
    assert.equal(await canAccessProject(owner.id, a.id), true)
    assert.equal(await canAccessProject(owner.id, b.id), false)
    await db.projectAccess.create({ data: { projectId: a.id, userId: outsider.id, role: 'VIEWER' } })
    assert.equal(await canAccessProject(outsider.id, a.id), true)
    assert.equal(await canEditProject(outsider.id, a.id), false)
    await db.projectAccess.deleteMany({ where: { projectId: a.id } })

    const foreignContract = await db.contract.create({ data: { projectId: b.id, title: 'Foreign', content: 'private' } })
    const ownContract = await db.contract.create({ data: { projectId: a.id, title: 'Own', content: 'own' } })
    const contract = load('src/app/api/projects/[id]/contracts/[contractId]/route')
    session = { user: { id: owner.id } }
    assert.equal((await contract.GET(request({}), params(a.id, { contractId: foreignContract.id }))).status, 404)
    assert.equal((await contract.GET(request({}), params(a.id, { contractId: ownContract.id }))).status, 200)
    const foreignFolder = await db.selectionFolder.create({ data: { projectId: b.id, name: 'Foreign', path: '/Foreign' } })
    const folder = load('src/app/api/projects/[id]/selection/folders/[folderId]/route')
    assert.equal((await folder.DELETE(request({}), params(a.id, { folderId: foreignFolder.id }))).status, 404)
    assert.equal((await folder.PATCH(request({ name: 'X', parentId: foreignFolder.id }), params(a.id, { folderId: foreignFolder.id }))).status, 404)
    assert.ok(await db.selectionFolder.findUnique({ where: { id: foreignFolder.id } }))

    const ensure = load('src/lib/folders').ensureFolderStructure
    for (const [kind, delegate] of [['selection', db.selectionFolder], ['results', db.resultFolder]]) {
      await Promise.all(Array.from({ length: 16 }, (_, i) => ensure(kind, a.id, `A/${i % 2 ? 'B' : 'C'}/image.jpg`)))
      const roots = await delegate.findMany({ where: { projectId: a.id, parentId: null, name: 'A' } })
      assert.equal(roots.length, 1)
      assert.equal(await delegate.count({ where: { projectId: a.id, parentId: roots[0].id } }), 2)
    }
    const root = await db.selectionFolder.findFirstOrThrow({ where: { projectId: a.id, name: 'A', parentId: null } })
    const child = await db.selectionFolder.findFirstOrThrow({ where: { projectId: a.id, parentId: root.id, name: 'B' } })
    assert.equal((await folder.PATCH(request({ name: 'A', parentId: child.id }), params(a.id, { folderId: root.id }))).status, 400)
    assert.equal((await folder.PATCH(request({ name: 'Renamed', parentId: null }), params(a.id, { folderId: root.id }))).status, 200)
    assert.equal((await db.selectionFolder.findUnique({ where: { id: child.id } })).path, '/Renamed/B')

    const moveA = await db.selectionFolder.create({ data: { projectId: a.id, name: 'MoveA', path: '/MoveA' } })
    const moveB = await db.selectionFolder.create({ data: { projectId: a.id, name: 'MoveB', path: '/MoveB' } })
    const moves = await Promise.all([
      folder.PATCH(request({ name: 'MoveA', parentId: moveB.id }), params(a.id, { folderId: moveA.id })),
      folder.PATCH(request({ name: 'MoveB', parentId: moveA.id }), params(a.id, { folderId: moveB.id })),
    ])
    assert.ok(moves.every(response => [200, 400, 409].includes(response.status)))
    assert.ok(moves.some(response => response.status === 200))
    const movedA = await db.selectionFolder.findUniqueOrThrow({ where: { id: moveA.id } })
    const movedB = await db.selectionFolder.findUniqueOrThrow({ where: { id: moveB.id } })
    assert.ok(!(movedA.parentId === moveB.id && movedB.parentId === moveA.id))
    assert.equal(await db.selectionFolder.count({ where: { id: { in: [moveA.id, moveB.id] } } }), 2)
    const [rename] = await Promise.all([
      folder.PATCH(request({ name: 'Again', parentId: null }), params(a.id, { folderId: root.id })),
      ensure('selection', a.id, 'Nested/image.jpg', root.id),
    ])
    assert.ok([200, 409].includes(rename.status))
    const finalRoot = await db.selectionFolder.findUniqueOrThrow({ where: { id: root.id } })
    const nested = await db.selectionFolder.findFirstOrThrow({ where: { projectId: a.id, parentId: root.id, name: 'Nested' } })
    assert.equal(nested.path, `${finalRoot.path}/Nested`)

    uploadDir = path.resolve('uploads', 'selection', a.id)
    fs.mkdirSync(uploadDir, { recursive: true })
    fs.writeFileSync(path.join(uploadDir, 'image.jpg'), 'synthetic original')
    fs.writeFileSync(path.join(uploadDir, 'preview_image.jpg.webp'), 'synthetic preview')
    const original = `/api/uploads/selection/${a.id}/image.jpg`
    const preview = `/api/uploads/selection/${a.id}/preview_image.jpg.webp`
    const image = await db.selectionImage.create({ data: { projectId: a.id, folderId: child.id, filename: 'image.jpg', path: original, thumbnail: preview } })
    const { canReadUpload } = load('src/lib/upload-access')
    assert.equal(await canReadUpload(original, owner.id), true)
    assert.equal(await canReadUpload(original, outsider.id), false)
    await db.project.update({ where: { id: a.id }, data: { isPublic: true, showSelectionPublicly: true, allowSelectionDownload: false } })
    assert.equal(await canReadUpload(preview), true)
    assert.equal(await canReadUpload(original), false)
    await db.project.update({ where: { id: a.id }, data: { allowSelectionDownload: true } })
    assert.equal(await canReadUpload(original), true)
    assert.equal(await canReadUpload(`/api/uploads/selection/${a.id}/unrecorded.jpg`), false)

    const bulk = load('src/app/api/projects/[id]/selection/images/bulk/route')
    assert.equal((await bulk.DELETE(request({ ids: [image.id] }), params(a.id))).status, 200)
    assert.equal(await db.selectionImage.count({ where: { id: image.id } }), 0)
    assert.equal(await db.fileCleanupJob.count(), 2)
    assert.ok(fs.existsSync(path.join(uploadDir, 'image.jpg')))
    await load('src/lib/file-cleanup').cleanupPendingFiles()
    assert.equal(await db.fileCleanupJob.count(), 0)
    assert.equal(fs.existsSync(path.join(uploadDir, 'image.jpg')), false)
    assert.equal(fs.existsSync(path.join(uploadDir, 'preview_image.jpg.webp')), false)
    moodDir = path.resolve('uploads', 'moodboard', a.id)
    fs.mkdirSync(moodDir, { recursive: true })
    const makeGroup = async (name, linkedElsewhere = false, isLibrary = false) => {
      const file = `${name}.jpg`
      fs.writeFileSync(path.join(moodDir, file), name)
      return db.moodboardGroup.create({ data: { name, ownerId: owner.id, isLibrary,
        projectLinks: { create: [{ projectId: a.id }, ...(linkedElsewhere ? [{ projectId: b.id }] : [])] },
        images: { create: { filename: file, path: `/api/uploads/moodboard/${a.id}/${file}` } },
      } })
    }
    const removedGroup = await makeGroup('removed')
    const orphan = await makeGroup('orphan')
    const shared = await makeGroup('shared', true)
    const library = await makeGroup('library', false, true)
    const groupRoute = load('src/app/api/projects/[id]/moodboard/groups/[groupId]/route')
    assert.equal((await groupRoute.DELETE(request({}), params(a.id, { groupId: removedGroup.id }))).status, 200)
    assert.equal(await db.moodboardGroup.count({ where: { id: removedGroup.id } }), 0)
    assert.equal(await db.fileCleanupJob.count({ where: { path: `moodboard/${a.id}/removed.jpg` } }), 1)
    const projectRoute = load('src/app/api/projects/[id]/route')
    assert.equal((await projectRoute.DELETE(request({}), params(a.id))).status, 200)
    assert.equal(await db.moodboardGroup.count({ where: { id: orphan.id } }), 0)
    assert.equal(await db.moodboardGroup.count({ where: { id: shared.id } }), 1)
    assert.equal(await db.moodboardGroup.count({ where: { id: library.id } }), 1)
    await load('src/lib/file-cleanup').cleanupPendingFiles()
    assert.equal(fs.existsSync(path.join(moodDir, 'removed.jpg')), false)
    assert.equal(fs.existsSync(path.join(moodDir, 'orphan.jpg')), false)
    assert.equal(fs.existsSync(path.join(moodDir, 'shared.jpg')), true)
    assert.equal(fs.existsSync(path.join(moodDir, 'library.jpg')), true)
    console.log('PASS: PostgreSQL authorization, project scopes, concurrent folders, rename/cycle checks, public previews and durable file cleanup.')
  } finally {
    if (uploadDir) fs.rmSync(uploadDir, { recursive: true, force: true })
    if (moodDir) fs.rmSync(moodDir, { recursive: true, force: true })
    await db.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`)
    await db.$disconnect()
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
