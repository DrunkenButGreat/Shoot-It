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
  const image = { id: 'synthetic-image', filename: 'test.jpg', path: '/test.jpg', thumbnail: null, ratings: null }
  const project = { id: 'synthetic-project', name: 'Synthetic project', description: null, date: null,
    location: null, shortCode: 'synthetic', isArchived: false, previewImage: null,
    participantCount: 0, selectionCount: 1, resultCount: 2, canDelete: true }
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
    const storage = render(DashboardContent, { projects: [project], storage: { totalBytes: 1024,
      projects: [{ id: project.id, name: project.name, imageCount: 3, bytes: 1024, isArchived: false }] } })
    assert.ok(storage.includes(dict.dashboard.storageTitle))
    assert.ok(storage.includes('1.0 KB'))
  }
  assert.equal(load('src/config/app.config').appConfig.limits.maxUploadSize, 100 * 1024 * 1024)

  let session = { user: { id: 'owner' } }
  let failed = false, deleted = 0, removed = 0
  const api = loader({
    '@/auth': { auth: async () => session },
    '@/lib/prisma': { __esModule: true, default: { project: {
      findUnique: async () => ({ id: 'test-project', ownerId: 'owner', moodboardLinks: [] }),
      delete: async () => { deleted++ },
    } } },
    '@/lib/permissions': {},
    'fs/promises': { rm: async () => { removed++; if (failed) throw new Error('Synthetic filesystem failure') } },
  })('src/app/api/projects/[id]/route')
  const params = { params: Promise.resolve({ id: 'test-project' }) }
  session = null
  assert.equal((await api.DELETE(null, params)).status, 401)
  session = { user: { id: 'viewer' } }
  assert.equal((await api.DELETE(null, params)).status, 403)
  assert.equal(deleted, 0)
  assert.equal(removed, 0)
  session = { user: { id: 'owner' } }
  failed = true
  const log = console.error
  try {
    console.error = () => {}
    assert.equal((await api.DELETE(null, params)).status, 500)
  } finally { console.error = log }
  assert.equal(deleted, 0, 'Filesystem failure must retain the database record')
  failed = false
  assert.equal((await api.DELETE(null, params)).status, 200)
  assert.equal(deleted, 1)
  assert.equal(removed, 4)
  console.log('PASS: retained delete actions in all gallery layouts, public results read-only, owner-only project controls, localized storage overview, 100 MiB upload limit and deletion failure/authorization boundaries.')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
