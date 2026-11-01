const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');

let hookIndex = 0;
const hooks = [];
let fetchMock;
let latestProps;
const mockReact = {
  ...React,
  useState(initial) {
    const index = hookIndex++;
    hooks[index] ??= initial;
    return [hooks[index], value => { hooks[index] = typeof value === 'function' ? value(hooks[index]) : value; }];
  },
  useRef(initial) {
    const index = hookIndex++;
    hooks[index] ??= { current: initial };
    return hooks[index];
  },
  useEffect(effect, deps) {
    const index = hookIndex++;
    const previous = hooks[index];
    if (!previous || !deps || deps.some((value, i) => !Object.is(value, previous.deps[i]))) {
      hooks[index] = { deps };
      effect();
    }
  },
};

global.fetch = (...args) => fetchMock(...args);
global.alert = () => {};
const filename = path.resolve('src/components/selection/RatingControls.tsx');
const componentModule = new Module(filename, module);
componentModule.filename = filename;
componentModule.paths = module.paths;
componentModule.require = id => id === 'react'
  ? mockReact
  : id === '@/components/I18nProvider'
    ? { useI18n: () => ({ t: key => key }) }
    : id === 'lucide-react'
      ? { Star: () => null }
      : require(id);
componentModule._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText, filename);
const { RatingControls } = componentModule.exports;

function render(props) {
  hookIndex = 0;
  latestProps = props;
  return RatingControls(props);
}
function stars(tree) { return tree.props.children[0].props.children; }
function colors(tree) { return tree.props.children[1].props.children; }

(async () => {
  const saved = [];
  fetchMock = async () => ({ ok: true, json: async () => ({ id: 'rating-two', stars: 2, color: 'YELLOW' }) });
  let tree = render({ projectId: 'p', imageId: 'one', initialRating: { id: 'r1', stars: 5, color: 'RED' }, onRatingUpdated: (id, rating) => saved.push([id, rating]) });
  assert.equal(stars(tree)[4].props['aria-pressed'], true);
  assert.equal(colors(tree)[0].props['aria-pressed'], true);

  tree = render({ ...latestProps, imageId: 'two', initialRating: { id: 'r2', stars: 1, color: 'GREEN' } });
  tree = render(latestProps);
  assert.equal(stars(tree)[0].props['aria-pressed'], true);
  assert.equal(stars(tree)[4].props['aria-pressed'], false);
  assert.equal(colors(tree)[2].props['aria-pressed'], true);
  await stars(tree)[1].props.onClick();
  assert.equal(saved[0][0], 'two');
  assert.deepEqual(saved[0][1], { id: 'rating-two', stars: 2, color: 'YELLOW' });

  fetchMock = async () => ({ ok: false, json: async () => ({ error: 'denied' }) });
  tree = render({ ...latestProps, imageId: 'three', initialRating: { id: 'r3', stars: 3, color: 'RED' } });
  tree = render(latestProps);
  await stars(tree)[4].props.onClick();
  tree = render(latestProps);
  assert.equal(stars(tree)[2].props['aria-pressed'], true);
  assert.equal(stars(tree)[4].props['aria-pressed'], false);
  assert.equal(colors(tree)[0].props['aria-pressed'], true);

  const delayedSaved = [];
  let resolvePut;
  fetchMock = () => new Promise(resolve => { resolvePut = resolve; });
  const pendingProps = { projectId: 'p', imageId: 'pending-one', initialRating: { id: 'r4', stars: 1, color: 'GREEN' }, onRatingUpdated: (id, rating) => delayedSaved.push([id, rating]) };
  tree = render(pendingProps);
  tree = render(pendingProps);
  const pendingSave = stars(tree)[1].props.onClick();

  const currentProps = { ...pendingProps, imageId: 'current-two', initialRating: { id: 'r5', stars: 4, color: 'RED' } };
  render(currentProps);
  tree = render(currentProps);
  assert.equal(stars(tree)[3].props['aria-pressed'], true);
  resolvePut({ ok: true, json: async () => ({ id: 'r4-saved', stars: 2, color: 'YELLOW' }) });
  await pendingSave;
  assert.equal(delayedSaved[0][0], 'pending-one');
  assert.deepEqual(delayedSaved[0][1], { id: 'r4-saved', stars: 2, color: 'YELLOW' });
  tree = render(currentProps);
  assert.equal(stars(tree)[3].props['aria-pressed'], true);
  assert.equal(colors(tree)[0].props['aria-pressed'], true);
  console.log('RatingControls state checks passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
