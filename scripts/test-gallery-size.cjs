const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')

let size = 100
let effects = []
let context
let scale
let writes = []
global.document = { documentElement: { style: { setProperty(key, value) {
    assert.equal(key, '--gallery-scale')
    scale = value
} } } }

function load(file, dependencies) {
    const filename = path.resolve(file)
    const mod = new Module(filename, module)
    mod.paths = module.paths
    mod.require = id => dependencies[id] || require(id)
    mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
    }).outputText, filename)
    return mod.exports
}

const { GallerySizeProvider } = load('src/components/GallerySizeProvider.tsx', {
    react: { ...React, useState: () => [size, value => { size = value }],
        useEffect: callback => effects.push(callback) },
})
const children = React.createElement('main', null, 'gallery')
function render() {
    effects = []
    const tree = GallerySizeProvider({ children })
    assert.equal(tree.props.children, children, 'Keep the gallery subtree mounted')
    context = tree.props.value
    return context
}
function mount(saved, blocked = false) {
    size = 100
    writes = []
    global.localStorage = {
        getItem(key) { assert.equal(key, 'shootit-gallery-size'); if (blocked) throw Error('blocked'); return saved },
        setItem(key, value) { if (blocked) throw Error('blocked'); writes.push([key, value]) },
    }
    assert.equal(render().size, 100, 'Server and first browser render use the same default')
    effects[0]()
    render()
    effects[1]()
    assert.equal(writes.length, 0, 'Restoring a preference must not overwrite storage')
}

for (const saved of [null, '', 'bad', '74', '201', '77', 'Infinity', 'NaN']) {
    mount(saved)
    assert.equal(context.size, 100)
    assert.equal(scale, '1')
}
for (const value of [75, 100, 150, 200]) {
    mount(String(value))
    assert.equal(context.size, value)
    assert.equal(scale, String(value / 100))
}
mount('125')
context.setSize(175)
render()
effects[1]()
assert.equal(context.size, 175)
assert.equal(scale, '1.75')
assert.deepEqual(writes, [['shootit-gallery-size', '175']])
for (const invalid of [0, 74, 201, 76, 100.5, NaN, Infinity]) context.setSize(invalid)
assert.equal(render().size, 175)
assert.equal(writes.length, 1)
mount(null, true)
context.setSize(200)
assert.equal(render().size, 200, 'Blocked storage does not disable the control')

let language = 'de'
const { GallerySizeControl } = load('src/components/GallerySizeControl.tsx', {
    react: { ...React, useId: () => 'gallery-size-test' },
    '@/components/GallerySizeProvider': { useGallerySize: () => context },
    '@/components/I18nProvider': { useI18n: () => ({ t: () => JSON.parse(fs.readFileSync(`src/dictionaries/${language}.json`)).common.imageSize }) },
})
for (language of ['de', 'en']) {
    const html = renderToStaticMarkup(GallerySizeControl())
    assert.ok(html.includes(language === 'de' ? 'Bildgröße' : 'Image size'))
    assert.ok(html.includes('for="gallery-size-test"'))
    for (const attribute of ['type="range"', 'min="75"', 'max="200"', 'step="5"', 'value="200"', 'aria-valuetext="200 %"']) assert.ok(html.includes(attribute), attribute)
}
GallerySizeControl().props.children[1].props.onChange({ target: { value: '75' } })
render()
assert.ok(renderToStaticMarkup(GallerySizeControl()).includes('value="75"'))
assert.ok(renderToStaticMarkup(GallerySizeControl()).includes('value="75"'), 'Other controls share the same value')

for (const file of ['selection/SelectionContent', 'results/ResultsContent', 'public/PublicSelection', 'public/PublicResults', 'public/PublicGallery', 'moodboard/MoodboardContent', 'moodboard/MoodboardCollection']) {
    assert.match(fs.readFileSync(`src/components/${file}.tsx`, 'utf8'), /<GallerySizeControl\s*\/>/, file)
}
for (const file of ['selection/SelectionImageGrid', 'results/ResultImageGrid', 'public/PublicSelection', 'public/PublicGallery']) {
    assert.match(fs.readFileSync(`src/components/${file}.tsx`, 'utf8'), /flexBasis:.*var\(--gallery-item-base-width\)/, file)
}
console.log('PASS: default, restoration, validation, persistence, blocked storage, shared controls, bilingual accessible slider and all gallery integrations.')
