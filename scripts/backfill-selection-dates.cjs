// Run after db:deploy; reads originals and only fills missing capture dates.
const { PrismaClient } = require('@prisma/client')
const sharp = require('sharp')
const path = require('node:path')
const { exifCaptureDate } = require('../src/lib/exif-date.js')

async function backfill(db) {
    const uploads = path.resolve('uploads')
    let cursor
    let updated = 0
    let missing = 0
    let failed = 0
    while (true) {
        const images = await db.selectionImage.findMany({
            where: { capturedAt: null }, orderBy: { id: 'asc' }, take: 100,
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
            select: { id: true, path: true },
        })
        if (!images.length) break
        for (const image of images) {
            try {
                if (!image.path.startsWith('/api/uploads/')) throw Error('Unsupported original path')
                const file = path.resolve(uploads, image.path.slice('/api/uploads/'.length))
                if (!file.startsWith(uploads + path.sep)) throw Error('Invalid original path')
                const capturedAt = exifCaptureDate((await sharp(file).metadata()).exif)
                if (!capturedAt) { missing++; continue }
                const result = await db.selectionImage.updateMany({ where: { id: image.id, capturedAt: null }, data: { capturedAt } })
                updated += result.count
            } catch {
                failed++
                console.error(`Could not read capture date for image ${image.id}`)
            }
        }
        cursor = images[images.length - 1].id
    }
    return { updated, missing, failed }
}

module.exports = { backfill }
if (require.main === module) {
    const db = new PrismaClient()
    backfill(db).then(result => {
        console.log(JSON.stringify(result))
        if (result.failed) process.exitCode = 1
    }).catch(() => {
        console.error('Capture-date backfill failed. Check database access and apply migrations first.')
        process.exitCode = 1
    }).finally(() => db.$disconnect())
}
