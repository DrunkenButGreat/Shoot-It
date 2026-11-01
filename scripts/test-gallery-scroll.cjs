const assert = require('node:assert/strict')
const fs = require('node:fs')
const Module = require('node:module')
const ts = require('typescript')

let effect
const target = {}
const observers = []
global.IntersectionObserver = class {
    constructor(callback, options) {
        this.callback = callback
        this.options = options
        observers.push(this)
    }
    observe(node) { this.target = node }
    disconnect() { this.disconnected = true }
}
const filename = require('node:path').resolve('src/components/GalleryLoadMore.tsx')
const mod = new Module(filename, module)
mod.paths = module.paths
mod.require = id => id === 'react' ? {
    useEffect: callback => { effect = callback },
    useRef: () => ({ current: target }),
} : id === '@/components/ui/button' ? { Button: 'button' }
    : id === '@/components/I18nProvider' ? { useI18n: () => ({ t: key => key }) }
    : require(id)
mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText, filename)

let loads = 0
const render = () => mod.exports.GalleryLoadMore({ onLoadMore: () => loads++, className: 'w-full' })
const button = render()
const cleanup = effect()
const observer = observers[0]
assert.equal(observer.target, target)
assert.equal(observer.options.rootMargin, '600px 0px')
observer.callback([{ isIntersecting: false }])
assert.equal(loads, 0)
observer.callback([{ isIntersecting: true }])
observer.callback([{ isIntersecting: true }])
assert.equal(loads, 1, 'Only load once per observer, even with queued notifications')
assert.ok(observer.disconnected)
cleanup()

render()
const cleanupNext = effect()
observers[1].callback([{ isIntersecting: true }])
assert.equal(loads, 2, 'The next batch can load when the button is still near the viewport')
cleanupNext()
observers[1].callback([{ isIntersecting: true }])
assert.equal(loads, 2, 'Ignore callbacks after cleanup')

delete global.IntersectionObserver
render()
assert.equal(effect(), undefined)
button.props.onClick()
assert.equal(loads, 3, 'Manual loading remains available without IntersectionObserver')
assert.equal(button.props.type, 'button')
assert.equal(button.props.children, 'common.loadMore')

for (const file of ['selection/SelectionContent', 'results/ResultsContent', 'public/PublicSelection', 'public/PublicResults', 'public/PublicGallery']) {
    const source = fs.readFileSync(`src/components/${file}.tsx`, 'utf8')
    assert.match(source, /visibleImages.length < (?:filteredImages|images).length && \(\s*<GalleryLoadMore/)
    assert.match(source, /onLoadMore=\{\(\) => setVisibleLimit\(/)
}
const css = fs.readFileSync('src/app/globals.css', 'utf8')
const masonryRules = [...css.matchAll(/\.shootit-gallery-masonry\s*\{([^}]+)\}/g)].map(match => match[1])
assert.match(masonryRules[0], /display:\s*grid/)
assert.match(masonryRules[0], /grid-template-columns:\s*repeat\(auto-fill, minmax\(/)
assert.ok(masonryRules.every(rule => !/(?:^|[;\s])columns:|column-count:|grid-auto-flow:\s*(column|dense)/.test(rule)), 'Keep existing tiles in place when appending images')
assert.match(masonryRules[1], /grid-template-columns:\s*repeat\(/)
console.log('PASS: gallery preloading, repeated batches, cleanup, manual fallback, all five galleries and stable row layout.')
