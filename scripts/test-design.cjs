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

function load(file) {
  const path = ['', '.tsx', '.ts', '.json'].map(ext => resolve(file + ext)).find(existsSync);
  assert.ok(path, `Missing module: ${file}`);
  if (path.endsWith('.json')) return JSON.parse(readFileSync(path, 'utf8'));
  if (cache.has(path)) return cache.get(path).exports;
  const mod = new Module(path, module);
  mod.filename = path;
  mod.paths = module.paths;
  mod.require = id => {
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

  // Uploaded participant portraits take precedence, and the virtual owner has no edit menu.
  const person = render(ParticipantCard, { participant, projectId: 'test' });
  assert.match(person, /src="\/portrait.jpg"/);
  assert.ok(person.includes(`${dictionary.common.actions}: Test Person`));
  const owner = render(ParticipantCard, { participant: { ...participant, id: 'owner-test' }, projectId: 'test' });
  assert.ok(!owner.includes(`${dictionary.common.actions}: Test Person`));
}
console.log('Design rendering checks passed in German and English.');
