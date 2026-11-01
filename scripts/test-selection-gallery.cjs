const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')
const React = require('react')
const sharp = require('sharp')
const { renderToStaticMarkup } = require('react-dom/server')
const { exifCaptureDate } = require('../src/lib/exif-date.js')

function exif(little, date = '2026:10:20 12:34:56', zone = '+02:00') {
    const data = Buffer.alloc(110)
    data.write(little ? 'II' : 'MM')
    const u16 = (value, offset) => little ? data.writeUInt16LE(value, offset) : data.writeUInt16BE(value, offset)
    const u32 = (value, offset) => little ? data.writeUInt32LE(value, offset) : data.writeUInt32BE(value, offset)
    u16(42, 2); u32(8, 4); u16(1, 8)
    u16(0x8769, 10); u16(4, 12); u32(1, 14); u32(26, 18)
    u16(2, 26)
    u16(0x9003, 28); u16(2, 30); u32(20, 32); u32(56, 36)
    u16(0x9011, 40); u16(2, 42); u32(7, 44); u32(76, 48)
    data.write(date, 56); data.write(zone, 76)
    return Buffer.concat([Buffer.from('Exif\0\0'), data])
}

function load(file, dependencies = {}) {
    const filename = path.resolve(file)
    const mod = new Module(filename, module)
    mod.paths = module.paths
    mod.require = id => dependencies[id] || require(id)
    mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
    }).outputText, filename)
    return mod.exports
}

async function main() {
    for (const little of [true, false]) {
        assert.equal(exifCaptureDate(exif(little)).toISOString(), '2026-10-20T10:34:56.000Z')
        assert.equal(exifCaptureDate(exif(little, '2026:10:20 12:34:56', '')).toISOString(), '2026-10-20T12:34:56.000Z')
        for (const invalid of ['0000:00:00 00:00:00', '2026:02:30 12:00:00', '2026:10:20 25:00:00', 'invalid']) assert.equal(exifCaptureDate(exif(little, invalid)), null)
        for (let length = 0; length < 82; length++) assert.equal(exifCaptureDate(exif(little).subarray(0, length)), null)
    }
    assert.equal(exifCaptureDate(), null)
    assert.equal(exifCaptureDate(Buffer.alloc(30)), null)

    const { sortSelectionImages } = load('src/lib/selection-sort.ts')
    const images = [
        { id: 'unknown', filename: 'img10.jpg', capturedAt: null, path: '/a.jpg', thumbnail: '/preview.webp', ratings: null },
        { id: 'new', filename: 'img2.jpg', capturedAt: '2026-10-20T12:00:00Z', path: '/b.jpg', thumbnail: null, ratings: null },
        { id: 'old', filename: 'img1.jpg', capturedAt: new Date('2026-10-19T12:00:00Z'), path: '/c.jpg', thumbnail: null, ratings: null },
        { id: 'invalid', filename: 'img20.jpg', capturedAt: 'invalid', path: '/d.jpg', thumbnail: null, ratings: null },
    ]
    assert.equal(sortSelectionImages(images, 'imported'), images)
    assert.deepEqual(sortSelectionImages(images, 'captured-asc').map(i => i.id), ['old', 'new', 'unknown', 'invalid'])
    assert.deepEqual(sortSelectionImages(images, 'captured-desc').map(i => i.id), ['new', 'old', 'unknown', 'invalid'])
    assert.deepEqual(sortSelectionImages(images, 'name').map(i => i.id), ['old', 'new', 'unknown', 'invalid'])
    assert.equal(images[0].id, 'unknown', 'Sorting must not mutate source images')

    const { SelectionImageList } = load('src/components/selection/SelectionImageList.tsx', {
        '@/components/I18nProvider': { useI18n: () => ({ t: key => key }) },
        '@/lib/image-preview': { imagePreviewSource: image => image.thumbnail || image.path },
        './RatingControls': { RatingControls: props => React.createElement('span', { 'data-readonly': props.disabled, 'data-guest': props.isGuest }, 'ratings') },
    })
    let preview, selected, deleted, downloaded
    const tree = SelectionImageList({ images, projectId: 'p', selectedIds: new Set(['unknown']), onPreview: index => { preview = index }, onToggleSelect: id => { selected = id }, onDelete: id => { deleted = id }, onDownload: image => { downloaded = image.id }, onRatingUpdated() {} })
    const first = tree.props.children[0].props.children
    first[0].props.children.props.onChange()
    first[1].props.onClick()
    first[3].props.onClick()
    first[4].props.onClick()
    assert.equal(preview, 0); assert.equal(selected, 'unknown'); assert.equal(deleted, 'unknown'); assert.equal(downloaded, 'unknown')
    const html = renderToStaticMarkup(tree)
    assert.ok(html.includes('/preview.webp')); assert.ok(html.includes('checked=""')); assert.ok(html.includes('img10.jpg'))
    const readonly = renderToStaticMarkup(SelectionImageList({ images, projectId: 'p', onPreview() {}, onRatingUpdated() {}, readOnly: true }))
    assert.ok(!readonly.includes('checkbox')); assert.ok(!readonly.includes('common.delete')); assert.ok(readonly.includes('data-readonly="true"'))

    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'shootit-capture-'))
    try {
        const file = path.join(folder, 'photo.jpg')
        await sharp({ create: { width: 20, height: 30, channels: 3, background: '#123456' } }).withExif({ IFD2: { DateTimeOriginal: '2026:10:20 12:34:56', OffsetTimeOriginal: '+02:00' } }).jpeg().toFile(file)
        assert.equal(exifCaptureDate((await sharp(file).metadata()).exif).toISOString(), '2026-10-20T10:34:56.000Z')
    } finally { fs.rmSync(folder, { recursive: true, force: true }) }

    const updates = []
    let calls = 0
    const { backfill } = load('scripts/backfill-selection-dates.cjs', {
        sharp: () => ({ metadata: async () => ({ exif: exif(true) }) }),
        '../src/lib/exif-date.js': { exifCaptureDate },
    })
    const result = await backfill({ selectionImage: {
        findMany: async input => { assert.deepEqual(input.where, { capturedAt: null }); return calls++ ? [] : [{ id: 'a', path: '/api/uploads/selection/p/a.jpg' }] },
        updateMany: async input => { updates.push(input); return { count: 1 } },
    } })
    assert.deepEqual(result, { updated: 1, missing: 0, failed: 0 })
    assert.deepEqual(updates[0].where, { id: 'a', capturedAt: null })
    console.log('PASS: EXIF byte orders, timezone, missing/corrupt dates, real JPEG metadata, sorting, list actions/permissions and non-destructive backfill.')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
