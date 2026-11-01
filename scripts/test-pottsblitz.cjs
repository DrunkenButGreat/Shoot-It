// Regression checks for the retained local features. All data and I/O are mocked.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')

function loader(overrides = {}) {
  const cache = new Map()
  return function load(file) {
    const filename = ['', '.tsx', '.ts', '.json'].map(ext => path.resolve(file + ext)).find(fs.existsSync)
    assert.ok(filename, `Missing module ${file}`)
    if (filename.endsWith('.json')) return JSON.parse(fs.readFileSync(filename, 'utf8'))
    if (cache.has(filename)) return cache.get(filename).exports
    const mod = new Module(filename, module)
    mod.filename = filename
    mod.paths = module.paths
    mod.require = id => {
      if (id in overrides) return overrides[id]
      if (id === 'next/navigation') return { useRouter: () => ({ refresh() {}, push() {} }) }
      if (id === 'next/link') return { __esModule: true, default: ({ children, ...props }) => React.createElement('a', props, children) }
      if (id.endsWith('.css')) return {}
      if (id.startsWith('@/')) return load(`src/${id.slice(2)}`)
      if (id.startsWith('.')) return load(path.resolve(path.dirname(filename), id))
      return require(id)
    }
    cache.set(filename, mod)
    mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    } }).outputText, filename)
    return mod.exports
  }
}

async function main() {
  const cards = []
  const load = loader({
    './ImageCard': { ImageCard: props => { cards.push(props); return null } },
    '../selection/ImageCard': { ImageCard: props => { cards.push(props); return null } },
    './ProjectForm': { ProjectForm: () => null },
    'yet-another-react-lightbox': { __esModule: true, default: () => null },
    'yet-another-react-lightbox/plugins/video': { __esModule: true, default: () => null },
  })
  const { I18nProvider } = load('src/components/I18nProvider')
  const { SelectionImageGrid } = load('src/components/selection/SelectionImageGrid')
  const { ResultImageGrid } = load('src/components/results/ResultImageGrid')
  const { ProjectCard } = load('src/components/projects/ProjectCard')
  const { DashboardContent } = load('src/components/projects/DashboardContent')
  const { StorageOverview } = load('src/components/projects/StorageOverview')
  const { formatBytes } = load('src/lib/format-bytes')
  const image = { id: 'synthetic-image', filename: 'test.jpg', path: '/test.jpg', thumbnail: null, ratings: null }
  const project = { id: 'synthetic-project', name: 'Synthetic project', description: null, date: null,
    location: null, shortCode: 'synthetic', isArchived: false, previewImage: null,
    participantCount: 0, selectionCount: 1, resultCount: 2, storageBytes: 1536, canDelete: true }
  for (const locale of ['de', 'en']) {
    const dict = load(`src/dictionaries/${locale}.json`)
    const render = (component, props) => renderToStaticMarkup(React.createElement(I18nProvider,
      { initialLocale: locale, initialDictionary: dict }, React.createElement(component, props)))
    for (const layout of ['grid', 'masonry', 'justified']) {
      cards.length = 0
      const deleted = []
      render(SelectionImageGrid, { images: [image], layout, projectId: project.id,
        onImageClick() {}, onRatingUpdated() {}, onDelete: id => deleted.push(id) })
      assert.equal(cards.length, 1)
      cards[0].onDelete()
      assert.deepEqual(deleted, [image.id], `Selection deletion in ${layout}`)
      cards.length = 0
      render(ResultImageGrid, { images: [image], layout, projectId: project.id,
        selectedIds: new Set(), onToggleSelect() {}, showDelete: false })
      assert.equal(cards.length, 1)
      assert.equal(cards[0].onDelete, undefined, `Public result deletion disabled in ${layout}`)
      cards.length = 0
      render(ResultImageGrid, { images: [image], layout, projectId: project.id,
        selectedIds: new Set(), onToggleSelect() {}, onDelete: id => deleted.push(id) })
      cards[0].onDelete()
      assert.deepEqual(deleted, [image.id, image.id])
    }
    const owner = render(ProjectCard, { project })
    const viewer = render(ProjectCard, { project: { ...project, canDelete: false } })
    assert.ok(owner.includes(dict.project.delete))
    assert.ok(!viewer.includes(dict.project.delete))
    assert.ok(owner.includes(dict.dashboard.storageLabel))
    assert.ok(viewer.includes(locale === 'de' ? '1,5 KB' : '1.5 KB'))
    assert.ok(render(ProjectCard, { project: { ...project, storageBytes: 0 } }).includes('0 B'))
    const storage = render(DashboardContent, { projects: [project], storage: { totalBytes: 1024,
      projects: [{ id: project.id, name: project.name, imageCount: 3, bytes: 1024, isArchived: false }] } })
    assert.ok(storage.includes(dict.dashboard.storageTitle))
    assert.ok(storage.includes(locale === 'de' ? '1,0 KB' : '1.0 KB'))
    const rankedProjects = [
      { id: 'zero', name: 'Zero', bytes: 0, imageCount: 0, isArchived: false },
      { id: 'beta', name: 'Beta', bytes: 1024, imageCount: 1, isArchived: false },
      { id: 'alpha', name: 'Alpha', bytes: 1024, imageCount: 2, isArchived: false },
      { id: 'largest', name: 'Largest', bytes: 2048, imageCount: 3, isArchived: true },
    ]
    const ranking = render(StorageOverview, { storage: { totalBytes: 3072, projects: rankedProjects } })
    assert.ok(ranking.indexOf('/project/largest') < ranking.indexOf('/project/alpha'))
    assert.ok(ranking.indexOf('/project/alpha') < ranking.indexOf('/project/beta'))
    assert.match(ranking, /<li hidden=""><a[^>]*href="\/project\/zero"/)
    assert.match(ranking, /aria-expanded="false" aria-controls="storage-projects"/)
    assert.ok(ranking.includes(dict.common.archived))
    assert.ok(ranking.includes('width:100%'))
    assert.ok(ranking.includes('width:50%'))
    assert.ok(ranking.includes(dict.dashboard.storageSharedHint))
    assert.deepEqual(rankedProjects.map(item => item.id), ['zero', 'beta', 'alpha', 'largest'])
    const empty = render(StorageOverview, { storage: { totalBytes: 0, projects: [] } })
    assert.ok(empty.includes(dict.dashboard.storageEmpty))
    assert.ok(!empty.includes('aria-expanded'))
    const zero = render(StorageOverview, { storage: { totalBytes: 0, projects: [rankedProjects[0]] } })
    assert.ok(!zero.includes('width:'))
    assert.ok(!zero.includes(dict.dashboard.storageEmpty))
    assert.equal(formatBytes(1.5 * 1024 ** 3, locale), locale === 'de' ? '1,5 GB' : '1.5 GB')
    assert.equal(formatBytes(0, locale), '0 B')
    assert.equal(formatBytes(1024 ** 4, locale), locale === 'de' ? '1,0 TB' : '1.0 TB')
    let expanded = false
    const interactionLoad = loader({
      react: { ...React, useState: () => [expanded, value => { expanded = value }] },
      '@/components/I18nProvider': { useI18n: () => ({ locale, t: key => key.split('.').reduce((value, part) => value[part], dict) }) },
    })
    const InteractiveStorage = interactionLoad('src/components/projects/StorageOverview').StorageOverview
    const findButton = node => {
      if (!React.isValidElement(node)) return undefined
      if (node.type === 'button') return node
      return React.Children.toArray(node.props.children).map(findButton).find(Boolean)
    }
    const draw = () => InteractiveStorage({ storage: { totalBytes: 3072, projects: rankedProjects } })
    findButton(draw()).props.onClick()
    const open = draw()
    assert.equal(findButton(open).props['aria-expanded'], true)
    assert.ok(!renderToStaticMarkup(open).includes('<li hidden="">'))
    assert.ok(renderToStaticMarkup(open).includes(dict.dashboard.storageShowLess))
    findButton(open).props.onClick()
    assert.equal(findButton(draw()).props['aria-expanded'], false)
  }
  // The page batches only authorized projects and keeps shared bytes outside personal totals.
  const storageCalls = []
  const pageLoad = loader({
    '@/auth': { auth: async () => ({ user: { id: 'owner', email: 'owner@example.test' } }) },
    '@/lib/prisma': { __esModule: true, default: { project: { findMany: async ({ where }) => {
      assert.deepEqual(where.OR, [{ ownerId: 'owner' }, { access: { some: { userId: 'owner' } } }, { participants: { some: { email: 'owner@example.test' } } }])
      return ['owned', 'shared'].map(id => ({ ...project, id, ownerId: id === 'owned' ? 'owner' : 'someone-else',
        date: null, _count: { participants: 1, selectionImages: 2, resultImages: 3 }, moodboardLinks: [] }))
    } } } },
    '@/lib/storage': { getStorageOverview: async ids => {
      storageCalls.push(ids)
      const bytes = ids[0] === 'owned' ? 1024 : 8192
      return { totalBytes: bytes, projects: ids.map(projectId => ({ projectId, bytes })) }
    } },
    '@/components/projects/DashboardContent': { DashboardContent: () => null },
  })
  const page = await pageLoad('src/app/dashboard/page').default()
  const props = page.props.children.props
  assert.deepEqual(storageCalls, [['owned'], ['shared']])
  assert.equal(props.storage.totalBytes, 1024)
  assert.deepEqual(props.storage.projects.map(item => item.id), ['owned'])
  assert.deepEqual(props.projects.map(item => item.storageBytes), [1024, 8192])
  assert.equal(load('src/config/app.config').appConfig.limits.maxUploadSize, 100 * 1024 * 1024)

  let session = { user: { id: 'owner' } }
  let deleted = 0
  const queued = []
  const db = { moodboardGroup: { findMany: async () => [] }, project: {
    findUnique: async () => ({ id: 'test-project', ownerId: 'owner', moodboardLinks: [] }),
    delete: async () => { deleted++ },
  } }
  db.$transaction = fn => fn(db)
  const api = loader({
    '@/auth': { auth: async () => session },
    '@/lib/prisma': { __esModule: true, default: db },
    '@/lib/permissions': {},
    '@/lib/file-cleanup': { queueFileCleanup: async (_, paths) => queued.push(...paths) },
  })('src/app/api/projects/[id]/route')
  const params = { params: Promise.resolve({ id: 'test-project' }) }
  session = null
  assert.equal((await api.DELETE(null, params)).status, 401)
  session = { user: { id: 'viewer' } }
  assert.equal((await api.DELETE(null, params)).status, 403)
  assert.equal(deleted, 0)
  assert.deepEqual(queued, [])
  session = { user: { id: 'owner' } }
  assert.equal((await api.DELETE(null, params)).status, 200)
  assert.equal(deleted, 1)
  assert.deepEqual(queued, ['selection/test-project', 'results/test-project', 'applications/test-project', 'projects/test-project'])
  console.log('PASS: retained delete actions in all gallery layouts, public results read-only, owner-only project controls, localized storage overview, 100 MiB upload limit and durable cleanup/authorization boundaries.')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
