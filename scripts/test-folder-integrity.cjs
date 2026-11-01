const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')
const { NextRequest } = require('next/server')
const root = path.resolve(__dirname, '..')
function load(file, overrides = {}) {
  const cache = new Map()
  function inner(name) {
    const filename = ['', '.ts', '.tsx', '.json'].map(ext => path.resolve(root, name + ext)).find(fs.existsSync)
    if (filename.endsWith('.json')) return JSON.parse(fs.readFileSync(filename))
    if (cache.has(filename)) return cache.get(filename).exports
    const mod = new Module(filename); mod.filename = filename
    mod.require = id => Object.hasOwn(overrides, id) ? overrides[id] : id.startsWith('@/') ? inner('src/' + id.slice(2)) : id.startsWith('.') ? inner(path.resolve(path.dirname(filename), id)) : require(id)
    cache.set(filename, mod)
    mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, filename)
    return mod.exports
  }
  return inner(file)
}
const ctx = { params: Promise.resolve({ id: 'a', folderId: 'foreign' }) }
const req = body => new NextRequest('http://localhost/test', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } })
const base = { '@/auth': { auth: async () => ({ user: { id: 'user' } }) }, '@/lib/permissions': { canEditProject: async () => true, canAccessProject: async () => false } }
;(async () => {
  let deleted = false
  const folders = { findFirst: async () => null, findMany: async () => { throw Error('must not read foreign folders') } }
  const db = { selectionFolder: folders, selectionImage: { findMany: async () => { throw Error('must not read foreign images') } } }
  db.$transaction = fn => fn(db)
  let route = load('src/app/api/projects/[id]/selection/folders/[folderId]/route.ts', { ...base, '@/lib/prisma': db, '@/lib/file-cleanup': { queueFileCleanup: async () => { deleted = true } } })
  assert.equal((await route.DELETE(req({}), ctx)).status, 404)
  assert.equal((await route.PATCH(req({ name: 'test' }), ctx)).status, 404)
  assert.equal(deleted, false)
  route = load('src/app/api/projects/[id]/selection/folders/route.ts', { ...base, '@/lib/prisma': db })
  assert.equal((await route.GET(req({}), ctx)).status, 403)

  const actions = []
  const ownDb = {
    selectionFolder: {
      findFirst: async () => ({ id: 'root', projectId: 'a' }),
      findMany: async () => [{ id: 'root', parentId: null }, { id: 'child', parentId: 'root' }],
      delete: async () => { actions.push('folder') },
    },
    selectionImage: {
      findMany: async ({ where }) => { assert.deepEqual(where.folderId.in, ['root', 'child']); return [{ path: '/api/uploads/selection/a/a.jpg', thumbnail: null }] },
      deleteMany: async () => { actions.push('images') },
    },
  }
  ownDb.$transaction = fn => fn(ownDb)
  route = load('src/app/api/projects/[id]/selection/folders/[folderId]/route.ts', { ...base, '@/lib/prisma': ownDb, '@/lib/file-cleanup': { queueFileCleanup: async (_, paths, prefix) => { assert.equal(prefix, 'selection/a'); assert.equal(paths[0], '/api/uploads/selection/a/a.jpg'); actions.push('queue') } } })
  assert.equal((await route.DELETE(req({}), { params: Promise.resolve({ id: 'a', folderId: 'root' }) })).status, 200)
  assert.deepEqual(actions, ['queue', 'images', 'folder'])

  for (const [file, model, body] of [
    ['src/app/api/projects/[id]/results/images/[imageId]/route.ts', 'resultFile', {}],
    ['src/app/api/projects/[id]/results/images/bulk/route.ts', 'resultFile', { imageIds: ['image'] }],
    ['src/app/api/projects/[id]/selection/images/bulk/route.ts', 'selectionImage', { ids: ['image'] }],
    ['src/app/api/moodboards/images/route.ts', 'moodboardImage', { imageIds: ['image'] }],
  ]) {
    const events = []
    const category = model === 'resultFile' ? 'results' : model === 'selectionImage' ? 'selection' : 'moodboard'
    const row = { id: 'image', projectId: 'a', path: `/api/uploads/${category}/a/image.jpg`, thumbnail: null, group: { ownerId: 'user' } }
    const mediaDb = { project: { findFirst: async () => ({ id: 'a' }) }, [model]: {
      findUnique: async () => row,
      findMany: async () => [row],
      delete: async () => events.push('delete'),
      deleteMany: async () => { events.push('delete'); return { count: 1 } },
    } }
    mediaDb.$transaction = fn => fn(mediaDb)
    const mediaRoute = load(file, { ...base, '@/lib/prisma': mediaDb, '@/lib/file-cleanup': { queueFileCleanup: async (_, paths) => { assert.deepEqual(paths, [row.path, null].filter(Boolean)); events.push('queue') } } })
    const response = await mediaRoute.DELETE(req(body), { params: Promise.resolve({ id: 'a', imageId: 'image' }) })
    assert.equal(response.status, 200, file)
    assert.deepEqual(events, ['queue', 'delete'], file)
  }

  const rows = []
  const delegate = {
    findFirst: async ({ where }) => rows.find(r => r.projectId === where.projectId && r.parentId === where.parentId && r.name === where.name) || null,
    create: async ({ data }) => {
      await new Promise(resolve => setTimeout(resolve, 1))
      if (rows.some(r => r.projectId === data.projectId && r.parentId === data.parentId && r.name === data.name)) throw Object.assign(Error('duplicate'), { code: 'P2002' })
      const row = { ...data, id: String(rows.length + 1) }; rows.push(row); return row
    },
  }
  const folderDb = { selectionFolder: delegate, resultFolder: delegate }
  folderDb.$transaction = fn => fn(folderDb)
  const ensure = load('src/lib/folders.ts', { '@/lib/prisma': folderDb }).ensureFolderStructure
  await Promise.all([ensure('selection', 'a', 'A/B/x.jpg'), ensure('selection', 'a', 'A/C/y.jpg')])
  assert.equal(rows.filter(row => row.name === 'A').length, 1)
  assert.deepEqual(rows.filter(row => row.name !== 'A').map(row => row.parentId), [rows[0].id, rows[0].id])

  const calls = []
  const appDb = { projectApplication: {
    findMany: async q => { assert.equal(q.where.status, 'REJECTED'); return [{ id: 'x', projectId: 'a' }] },
    deleteMany: async q => { assert.equal(q.where.status, 'REJECTED'); return { count: 0 } },
  } }
  appDb.$transaction = fn => fn(appDb)
  const cleanup = load('src/lib/application-cleanup.ts', { '@/lib/prisma': appDb, '@/lib/file-cleanup': { queueFileCleanup: async () => calls.push('queue') } }).cleanupExpiredApplications
  await cleanup(); assert.deepEqual(calls, [])
  const jobs = [{ path: 'selection/a/image.jpg' }, { path: 'moodboard/a/group/shared.jpg' }]
  const removed = []
  let fail = true
  const cleanupDb = {
    fileCleanupJob: {
      findMany: async () => [...jobs],
      updateMany: async () => ({}),
      deleteMany: async ({ where }) => { const index = jobs.findIndex(job => job.path === where.path); if (index >= 0) jobs.splice(index, 1) },
    },
    moodboardImage: { findFirst: async ({ where }) => where.OR[0].path.includes('/moodboard/') ? ({ id: 'surviving-reference' }) : null },
    selectionImage: { findFirst: async () => null },
    resultFile: { findFirst: async () => null },
    participantImage: { findFirst: async () => null },
    applicationImage: { findFirst: async () => null },
  }
  const fileCleanup = load('src/lib/file-cleanup.ts', { '@/lib/prisma': cleanupDb, 'fs/promises': { rm: async file => { if (fail) throw Error('disk failure'); removed.push(file) } } })
  const savedError = console.error; console.error = () => {}
  try { await fileCleanup.cleanupPendingFiles() } finally { console.error = savedError }
  assert.deepEqual(jobs.map(job => job.path), ['selection/a/image.jpg'])
  assert.equal(removed.length, 0)
  fail = false
  await fileCleanup.cleanupPendingFiles()
  assert.equal(jobs.length, 0)
  assert.equal(removed.length, 1)
  await assert.rejects(() => fileCleanup.queueFileCleanup({}, ['/api/uploads/selection/other/file.jpg'], 'selection/a'))
  let sequence = 0
  const backlog = Array.from({ length: 101 }, (_, i) => ({ path: `selection/a/${i}.jpg`, createdAt: i }))
  const backlogDb = {
    fileCleanupJob: {
      findMany: async () => [...backlog].sort((a, b) => a.createdAt - b.createdAt).slice(0, 100),
      updateMany: async ({ where }) => { backlog.find(job => job.path === where.path).createdAt = 1000 + sequence++ },
      deleteMany: async ({ where }) => { const index = backlog.findIndex(job => job.path === where.path); if (index >= 0) backlog.splice(index, 1) },
    },
    ...Object.fromEntries(['selectionImage', 'resultFile', 'moodboardImage', 'participantImage', 'applicationImage'].map(model => [model, { findFirst: async () => null }])),
  }
  const rotateCleanup = load('src/lib/file-cleanup.ts', { '@/lib/prisma': backlogDb, 'fs/promises': { rm: async file => { if (!file.endsWith('/100.jpg')) throw Error('permanent failure') } } }).cleanupPendingFiles
  const oldError = console.error; console.error = () => {}
  try {
    await rotateCleanup()
    assert.equal(backlog.length, 101)
    await rotateCleanup()
    assert.equal(backlog.length, 100)
    assert.ok(!backlog.some(job => job.path.endsWith('/100.jpg')))
  } finally { console.error = oldError }
  let release
  let appRuns = 0, fileRuns = 0
  const scheduler = load('src/lib/cleanup-scheduler.ts', {
    '@/lib/application-cleanup': { cleanupExpiredApplications: async () => { appRuns++; await new Promise(resolve => { release = resolve }); throw Error('synthetic failure') } },
    '@/lib/file-cleanup': { cleanupPendingFiles: async () => { fileRuns++ } },
  })
  const previousError = console.error; console.error = () => {}
  try {
    const first = scheduler.runCleanups()
    await scheduler.runCleanups()
    assert.equal(appRuns, 1)
    release()
    await first
    assert.equal(fileRuns, 1)
  } finally { console.error = previousError }
  console.log('Folder ownership, concurrent creation, accepted-application cleanup, and retry checks passed')
})().catch(error => { console.error(error); process.exitCode = 1 })
