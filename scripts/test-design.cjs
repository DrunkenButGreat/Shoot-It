// Offline rendering checks; no server, account, network, or database access.
// Run with: node scripts/test-design.cjs
const assert = require('node:assert/strict');
const { readFileSync, existsSync } = require('node:fs');
const { resolve, dirname } = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const cache = new Map();

function load(file, overrides = {}) {
  const path = ['', '.tsx', '.ts', '.json'].map(ext => resolve(file + ext)).find(existsSync);
  assert.ok(path, `Missing module: ${file}`);
  if (path.endsWith('.json')) return JSON.parse(readFileSync(path, 'utf8'));
  if (cache.has(path)) return cache.get(path).exports;
  const mod = new Module(path, module);
  mod.filename = path;
  mod.paths = module.paths;
  mod.require = id => {
    if (Object.hasOwn(overrides, id)) return overrides[id];
    if (id.endsWith('.css')) return {};
    if (id === 'next/navigation') return { useRouter: () => ({ refresh() {} }) };
    if (id.startsWith('@/')) return load(`src/${id.slice(2)}`);
    if (id.startsWith('.')) return load(resolve(dirname(path), id));
    return require(id);
  };
  cache.set(path, mod);
  mod._compile(ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, path);
  return mod.exports;
}

const { I18nProvider } = load('src/components/I18nProvider');
const { ImageCard } = load('src/components/selection/ImageCard');
const { ParticipantCard } = load('src/components/participants/ParticipantCard');
const { PasswordInput } = load('src/components/auth/PasswordInput');
const { CallsheetContent } = load('src/components/callsheet/CallsheetContent');
const { PublicSelection } = load('src/components/public/PublicSelection');
const { PublicGallery } = load('src/components/public/PublicGallery');
const { ResultsContent } = load('src/components/results/ResultsContent');
cache.delete(resolve('src/components/results/ResultImageGrid.tsx'));
const { ResultImageGrid } = load('src/components/results/ResultImageGrid', {
  'yet-another-react-lightbox': props => React.createElement('div', { 'data-slide-count': props.slides.length }),
  'yet-another-react-lightbox/plugins/video': () => null,
});
let hookIndex = 0;
let hookState = [];
let pendingEffects = [];
let testDictionary;
const publicResultsReact = {
  ...React,
  useState(initial) {
    const index = hookIndex++;
    if (!(index in hookState)) hookState[index] = typeof initial === 'function' ? initial() : initial;
    return [hookState[index], value => { hookState[index] = typeof value === 'function' ? value(hookState[index]) : value; }];
  },
  useMemo: factory => factory(),
  useEffect: effect => pendingEffects.push(effect),
};
cache.delete(resolve('src/components/public/PublicResults.tsx'));
const { PublicResults } = load('src/components/public/PublicResults', {
  react: publicResultsReact,
  '@/components/I18nProvider': { useI18n: () => ({ t: key => key.split('.').reduce((value, part) => value?.[part], testDictionary) || key }) },
  '../results/FolderTree': { FolderTree: () => null },
  '../results/ResultImageGrid': { ResultImageGrid: ({ images, allImages }) => React.createElement('div', { 'data-grid-count': images.length, 'data-all-count': allImages.length }, images.map(image => React.createElement('span', { key: image.id }, image.filename))) },
});
const { scheduleItemSchema } = load('src/lib/validations');
const image = { id: 'sample', filename: 'Sample.jpg', path: '/sample.jpg', thumbnail: null, ratings: null };
const participant = { id: 'person', name: 'Test Person', role: 'Model', email: null, phone: null, notes: null, images: [{ path: '/portrait.jpg' }] };
const noop = () => {};
const { matchesSelectionFilters } = load('src/lib/selection-filters');
const filters = { folderId: null, stars: [], colors: [], unrated: false };
const rated = { folderId: 'folder', ratings: { stars: 4, color: 'GREEN' } };
assert.ok(matchesSelectionFilters(rated, { ...filters, stars: ['3', '4'], colors: ['GREEN'] }));
assert.ok(!matchesSelectionFilters(rated, { ...filters, stars: ['5'], colors: ['GREEN'] }));
assert.ok(!matchesSelectionFilters(rated, { ...filters, folderId: 'unassigned' }));
assert.ok(!matchesSelectionFilters(rated, { ...filters, unrated: true }));
assert.ok(matchesSelectionFilters({ ratings: null }, { ...filters, folderId: 'unassigned', unrated: true }));


(async () => {
for (const locale of ['de', 'en']) {
  const dictionary = load(`src/dictionaries/${locale}.json`);
  const render = (component, props) => renderToStaticMarkup(React.createElement(I18nProvider,
    { initialLocale: locale, initialDictionary: dictionary }, React.createElement(component, props)));
  // Schedule timestamps must survive server serialization and render in the browser locale.
  const time = '2026-10-14T07:30:00.000Z';
  const schedule = scheduleItemSchema.parse({ time, activity: 'Lighting setup', notes: 'Test studio' });
  const callsheet = render(CallsheetContent, { projectId: 'test', initialCallsheet: { id: 'test', callTime: time, locationName: null, locationAddress: null, additionalNotes: null, scheduleItems: [{ id: 'item', ...schedule }] } });
  assert.ok(callsheet.includes(new Date(time).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })));
  assert.ok(callsheet.includes('Lighting setup'));
  assert.ok(callsheet.includes('Test studio'));
  assert.ok(!callsheet.includes('Invalid Date'));

  const password = render(PasswordInput, { id: 'password', autoComplete: 'current-password' });
  assert.match(password, /type="password"/);
  assert.match(password, /type="button"/);
  assert.ok(password.includes(dictionary.auth.showPassword));

  // The shared contact sheet keeps public ratings read-only and disables dragging.
  const publicCard = render(ImageCard, { image, projectId: 'test', readOnly: true, onSelect: noop });
  assert.match(publicCard, /draggable="false"/);
  assert.ok(!publicCard.includes(`${dictionary.design.selectImage}: Sample.jpg`));
  assert.equal((publicCard.match(/disabled=""/g) || []).length, 8);
  assert.ok(publicCard.includes(dictionary.design.preview));

  // Explicit download selection remains available in a read-only results gallery.
  const selectable = render(ImageCard, { image, projectId: 'test', readOnly: true, forceSelectable: true, onSelect: noop, selected: true, hideRatings: true });
  assert.ok(selectable.includes(`${dictionary.design.selectImage}: Sample.jpg`));
  assert.match(selectable, /aria-pressed="true"/);

  const privateCard = render(ImageCard, { image, projectId: 'test', onSelect: noop, hideRatings: true });
  assert.match(privateCard, /draggable="true"/);
  assert.ok(privateCard.includes(`${dictionary.design.selectImage}: Sample.jpg`));

  // Participant uploads fill missing portraits; linked profile photos take precedence.
  const person = render(ParticipantCard, { participant, projectId: 'test' });
  assert.match(person, /src="\/portrait.jpg"/);
  const linked = render(ParticipantCard, { participant: { ...participant, user: { id: 'linked', name: 'Test', image: '/profile.jpg' } }, projectId: 'test' });
  assert.match(linked, /src="\/profile.jpg"/);
  assert.ok(!linked.includes('src="/portrait.jpg"'));

  assert.ok(person.includes(`${dictionary.common.actions}: Test Person`));
  const owner = render(ParticipantCard, { participant: { ...participant, id: 'owner-test' }, projectId: 'test' });
  assert.ok(!owner.includes(`${dictionary.common.actions}: Test Person`));

  const manyImages = Array.from({ length: 101 }, (_, index) => ({
    id: `image-${index}`,
    filename: `image-${index}.jpg`,
    path: `/image-${index}.jpg`,
    thumbnail: null,
    ratings: null,
  }));
  const publicSelection = render(PublicSelection, {
    projectId: 'test', images: manyImages, folders: [], userHasAccess: false,
    isAuthenticated: false, allowDownload: false,
  });
  assert.ok(publicSelection.includes('image-99.jpg'));
  assert.ok(!publicSelection.includes('image-100.jpg'));
  assert.ok(publicSelection.includes(dictionary.common.loadMore));

  const publicGallery = render(PublicGallery, { images: manyImages, layout: 'grid' });
  assert.ok(publicGallery.includes('image-99.jpg'));
  assert.ok(!publicGallery.includes('image-100.jpg'));
  assert.ok(publicGallery.includes(dictionary.common.loadMore));

  const results = render(ResultsContent, {
    projectId: 'test', initialFolders: [], rootImages: manyImages.map(image => ({
      ...image, folderId: null, createdAt: new Date('2026-01-01'), width: 100, height: 100,
    })),
  });
  assert.ok(results.includes('image-99.jpg'));
  assert.ok(!results.includes('image-100.jpg'));
  assert.ok(results.includes(dictionary.common.loadMore));

  const resultsGrid = render(ResultImageGrid, {
    images: manyImages.slice(0, 100).map(image => ({ ...image, folderId: null })),
    allImages: manyImages.map(image => ({ ...image, folderId: null })),
    selectedIds: new Set(), onToggleSelect: noop, projectId: 'test', layout: 'grid',
  });
  assert.ok(resultsGrid.includes('image-99.jpg'));
  assert.ok(!resultsGrid.includes('image-100.jpg'));
  assert.ok(resultsGrid.includes('data-slide-count="101"'));

  testDictionary = dictionary;
  hookIndex = 0;
  hookState = [];
  pendingEffects = [];
  PublicResults({ projectId: 'test' });
  global.fetch = async () => ({ ok: true, json: async () => ({ rootImages: manyImages.map(image => ({ ...image, folderId: null })), folders: [], galleryLayout: 'grid' }) });
  for (const effect of pendingEffects) effect();
  await new Promise(resolve => setTimeout(resolve, 0));
  hookIndex = 0;
  const loadedPublicResults = PublicResults({ projectId: 'test' });
  const publicResults = renderToStaticMarkup(React.createElement(I18nProvider,
    { initialLocale: locale, initialDictionary: dictionary }, loadedPublicResults));
  assert.ok(publicResults.includes('image-99.jpg'));
  assert.ok(!publicResults.includes('image-100.jpg'));
  assert.ok(publicResults.includes(dictionary.common.loadMore));
  assert.ok(publicResults.includes('data-grid-count="100"'));
  assert.ok(publicResults.includes('data-all-count="101"'));
}
console.log('Design rendering checks passed in German and English.');
})().catch(error => { console.error(error); process.exitCode = 1; });
