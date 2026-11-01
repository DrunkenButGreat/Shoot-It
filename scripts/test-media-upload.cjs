const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')

function load(file, mocks = {}) {
    const filename = path.resolve(file)
    const mod = new Module(filename, module)
    mod.filename = filename
    mod.paths = module.paths
    mod.require = id => mocks[id] || require(id)
    mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    }).outputText, filename)
    return mod.exports
}
let now = 0
let interval
let requests = []
let delays = []
const original = { now: Date.now, setInterval, clearInterval, setTimeout }
Date.now = () => now
global.setInterval = (fn, delay) => { assert.equal(delay, 250); interval = fn; return 1 }
global.clearInterval = () => { interval = null }
global.setTimeout = (fn, delay) => { delays.push(delay); queueMicrotask(fn); return 1 }
class XHR {
    upload = {}
    open(method, url) { this.method = method; this.url = url }
    send(body) { this.body = body; requests.push(this) }
    progress(loaded, total, lengthComputable = true) { this.upload.onprogress({ loaded, total, lengthComputable }) }
    sent() { this.upload.onload() }
    respond(status = 200, body = '{"id":"saved"}') { this.status = status; this.responseText = body; this.onload() }
}
global.XMLHttpRequest = XHR
const { uploadMedia } = load('src/lib/media-upload.ts')
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve() }
const file = (size, name = 'photo.jpg') => new File([new Uint8Array(size)], name, { type: 'image/jpeg' })
const tick = time => { now = time; interval() }
function reset() { now = 0; requests = []; delays = [] }

async function transportTests() {
    let state
    reset()
    const small = file(100); small.relativePath = 'shoot/day/photo.jpg'
    const promise = uploadMedia([small, file(900)], '/api/test', 'folder-a', value => { state = value })
    assert.equal(requests.length, 2)
    assert.equal(requests[0].body.get('relativePath'), small.relativePath)
    assert.equal(requests[0].body.get('folderId'), 'folder-a')
    assert.equal(requests[0].body.get('file').size, 100)
    assert.equal(requests[0].method, 'POST'); assert.equal(requests[0].url, '/api/test')
    requests[0].sent(); requests[0].respond()
    await flush()
    requests[1].progress(500, 1000) // Multipart bytes normalized to the 900-byte file.
    tick(1000); assert.equal(state.percent, 55); assert.equal(state.remainingSeconds, null)
    tick(2000); assert.equal(state.completed, 1); assert.equal(state.remainingSeconds, 2)
    tick(5000); assert.equal(state.remainingSeconds, null, 'Stalled transfer must hide ETA')
    requests[1].progress(900, 1000, false); tick(5250); assert.equal(state.percent, 55)
    requests[1].sent(); tick(5500)
    assert.equal(state.percent, 100); assert.equal(state.processing, true); assert.equal(state.completed, 1)
    requests[1].respond(200, '{"url":"/branding.jpg"}')
    assert.deepEqual(await promise, { lastResult: { url: '/branding.jpg' }, failed: 0 })
    assert.equal(state.completed, 2); assert.equal(interval, null)

    reset()
    const pool = uploadMedia(Array.from({ length: 8 }, () => file(100)), '/pool', undefined, value => { state = value })
    assert.equal(requests.length, 6)
    requests[0].sent(); requests[0].respond(); await flush()
    assert.equal(requests.length, 7)
    tick(250); assert.equal(state.percent, 12, 'Waiting files are included in the total')
    requests[1].respond(); await flush(); assert.equal(requests.length, 8)
    for (const request of requests.slice(2)) request.respond()
    await pool; assert.equal(state.completed, 8)
    assert.equal(requests[0].body.get('folderId'), null)

    reset()
    const retry = uploadMedia([file(100)], '/retry', undefined, value => { state = value })
    requests[0].progress(50, 100); tick(2000); assert.equal(state.remainingSeconds, 2)
    requests[0].respond(503, 'temporarily unavailable'); await flush()
    tick(2250); assert.equal(state.percent, 0); assert.equal(state.remainingSeconds, null)
    requests[1].onerror(); await flush()
    requests[2].respond(200, 'invalid json'); await flush()
    requests[3].respond(); await retry
    assert.deepEqual(delays, [400, 800, 1200]); assert.equal(requests.length, 4); assert.equal(state.completed, 1)

    reset()
    const failed = uploadMedia([file(100), file(100)], '/errors', undefined, value => { state = value })
    requests[0].respond(403, 'Forbidden'); requests[1].respond(400, '{"error":"Invalid file"}')
    assert.equal((await failed).failed, 2); assert.equal(requests.length, 2); assert.equal(state.completed, 0)
    assert.equal(state.failed, 2); assert.equal(state.percent, 0)

    reset()
    const exhausted = uploadMedia([file(100)], '/errors', undefined, value => { state = value })
    for (let i = 0; i < 4; i++) { requests[i].respond(500, 'error'); await flush() }
    assert.equal((await exhausted).failed, 1); assert.equal(state.completed, 0)
    assert.equal(interval, null)

    reset()
    const empty = uploadMedia([file(0)], '/empty', undefined, value => { state = value })
    requests[0].sent(); tick(250); assert.equal(state.processing, true); assert.equal(state.remainingSeconds, null)
    requests[0].respond(); await empty
}

async function componentTests() {
    let hooks = [], index = 0, dictionary, callback, resolveUpload, calls = 0, lastFiles
    const alerts = []
    global.alert = message => alerts.push(message)
    const mocks = {
        react: { ...React,
            useState(initial) { const i = index++; if (!(i in hooks)) hooks[i] = initial; return [hooks[i], value => { hooks[i] = typeof value === 'function' ? value(hooks[i]) : value }] },
            useRef(initial) { const i = index++; if (!(i in hooks)) hooks[i] = { current: initial }; return hooks[i] },
            useCallback: fn => fn,
            useEffect: () => {},
        },
        '@/components/ui/button': { Button: props => React.createElement('button', props) },
        '@/lib/utils': { cn: (...values) => values.filter(Boolean).join(' ') },
        '@/components/I18nProvider': { useI18n: () => ({ t: key => key.split('.').reduce((value, part) => value?.[part], dictionary) || key }) },
        '@/lib/media-upload': { uploadMedia: (files, url, folderId, progress) => {
            calls++; lastFiles = files; callback = progress
            progress({ percent: 0, completed: 0, failed: 0, total: files.length, remainingSeconds: null, processing: false })
            return new Promise(resolve => { resolveUpload = resolve })
        } },
    }
    const Component = load('src/components/moodboard/ImageUpload.tsx', mocks).default
    const render = props => { index = 0; return Component(props) }
    const find = (tree, type) => {
        if (!tree || typeof tree !== 'object') return null
        if (tree.type === type || tree.props?.role === type) return tree
        for (const child of React.Children.toArray(tree.props?.children)) { const result = find(child, type); if (result) return result }
        return null
    }
    const event = files => ({ preventDefault() {}, stopPropagation() {}, dataTransfer: { items: [], files } })
    for (const lang of ['de', 'en']) {
        dictionary = JSON.parse(fs.readFileSync(`src/dictionaries/${lang}.json`))
        for (const mode of ['normal', 'compact', 'wrapper']) {
            hooks = []; calls = 0
            const saved = []
            const props = { uploadUrl: '/upload', onSuccess: value => saved.push(value), compact: mode === 'compact', children: mode === 'wrapper' ? React.createElement('button', {}, 'Gallery') : undefined }
            let tree = render(props)
            const selected = file(100); selected.webkitRelativePath = 'folder/photo.jpg'
            find(tree, 'input').props.onChange({ target: { files: [selected] } })
            assert.equal(lastFiles[0].relativePath, selected.webkitRelativePath)
            find(tree, 'input').props.onChange({ target: { files: [file(100)] } })
            await tree.props.onDrop(event([file(100)])); assert.equal(calls, 1, 'Synchronous lock blocks overlapping uploads')
            callback({ percent: 42, completed: 1, failed: 0, total: 3, remainingSeconds: 80, processing: false })
            tree = render(props)
            assert.equal(find(tree, 'input').props.disabled, true)
            const progress = find(tree, 'progressbar'); assert.equal(progress.props['aria-valuenow'], 42)
            assert.equal(progress.props['aria-label'], dictionary.upload.progress)
            const html = renderToStaticMarkup(tree)
            assert.ok(html.includes('42%')); assert.ok(!html.includes('upload.remaining'))
            assert.ok(html.includes(lang === 'de' ? '1 Min. 20 Sek.' : '1 min 20 sec'))
            callback({ percent: 100, completed: 2, failed: 0, total: 3, remainingSeconds: null, processing: true })
            assert.ok(renderToStaticMarkup(render(props)).includes(dictionary.upload.processing))
            resolveUpload({ lastResult: { url: '/saved' }, failed: 0 }); await flush()
            tree = render(props); assert.equal(find(tree, 'progressbar'), null); assert.deepEqual(saved, [{ url: '/saved' }])
            assert.equal(find(tree, 'input').props.disabled, false)
            const drop = tree.props.onDrop(event([file(100)])); assert.equal(calls, 2)
            resolveUpload({ lastResult: null, failed: 1 }); await drop
            assert.equal(alerts.at(-1), dictionary.selection.uploadPartialFailed.replace('{failed}', '1').replace('{total}', '1'))
            tree = render({ ...props, disabled: true }); await tree.props.onDrop(event([file(100)])); assert.equal(calls, 2)
        }
    }
}

(async () => {
    try {
        await transportTests(); await componentTests()
        console.log('PASS: weighted progress, ETA/stall/retry, bounded concurrency, processing vs success, failures, payloads, upload locking/reset, all layouts and DE/EN accessibility.')
    } finally {
        Date.now = original.now
        global.setInterval = original.setInterval; global.clearInterval = original.clearInterval; global.setTimeout = original.setTimeout
    }
})().catch(error => { console.error(error); process.exitCode = 1 })
