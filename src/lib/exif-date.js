/** Read DateTimeOriginal from the TIFF data in a Sharp EXIF buffer.
 * @param {Buffer | undefined} exif
 * @returns {Date | null}
 */
function exifCaptureDate(exif) {
    if (!exif) return null
    try {
        const data = exif.subarray(exif.toString('ascii', 0, 6) === 'Exif\0\0' ? 6 : 0)
        const little = data.toString('ascii', 0, 2) === 'II'
        if (!little && data.toString('ascii', 0, 2) !== 'MM') return null
        const u16 = offset => little ? data.readUInt16LE(offset) : data.readUInt16BE(offset)
        const u32 = offset => little ? data.readUInt32LE(offset) : data.readUInt32BE(offset)
        if (u16(2) !== 42) return null
        function entry(directory, tag) {
            const count = u16(directory)
            if (directory + 2 + count * 12 > data.length) return null
            for (let i = 0; i < count; i++) {
                const offset = directory + 2 + i * 12
                if (u16(offset) === tag) return offset
            }
            return null
        }
        const pointer = entry(u32(4), 0x8769)
        if (pointer === null || u16(pointer + 2) !== 4 || u32(pointer + 4) !== 1) return null
        const directory = u32(pointer + 8)
        function text(tag) {
            const offset = entry(directory, tag)
            if (offset === null || u16(offset + 2) !== 2) return null
            const length = u32(offset + 4)
            const start = length <= 4 ? offset + 8 : u32(offset + 8)
            if (length < 1 || start + length > data.length) return null
            return data.toString('ascii', start, start + length).replace(/\0.*$/, '')
        }
        const original = text(0x9003)
        if (!original || !/^\d{4}:\d{2}:\d{2} \d{2}:\d{2}:\d{2}$/.test(original)) return null
        const [year, month, day, hour, minute, second] = original.match(/\d+/g).map(Number)
        if (year < 1900) return null
        const wallTime = new Date(Date.UTC(year, month - 1, day, hour, minute, second))
        if (wallTime.getUTCFullYear() !== year || wallTime.getUTCMonth() !== month - 1 || wallTime.getUTCDate() !== day || wallTime.getUTCHours() !== hour || wallTime.getUTCMinutes() !== minute || wallTime.getUTCSeconds() !== second) return null
        const zone = text(0x9011)
        if (zone && !/^[+-](?:0\d|1[0-4]):[0-5]\d$/.test(zone)) return null
        // Without a camera timezone, preserve its wall-clock time consistently as UTC.
        return zone ? new Date(`${wallTime.toISOString().slice(0, 19)}${zone}`) : wallTime
    } catch {
        return null
    }
}

module.exports = { exifCaptureDate }
