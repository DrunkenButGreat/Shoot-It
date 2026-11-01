export type MediaUploadFile = File & { relativePath?: string }

export interface UploadProgress {
    percent: number
    completed: number
    failed: number
    total: number
    remainingSeconds: number | null
    processing: boolean
}

// Keep transport progress separate from the server's final response (preview generation).
export async function uploadMedia(
    files: MediaUploadFile[],
    url: string,
    folderId: string | undefined,
    onProgress: (progress: UploadProgress) => void,
) {
    const entries = files.map(file => ({ file, loaded: 0, sent: false, done: false, failed: false }))
    let lastResult: any = null
    let cursor = 0
    let started = Date.now()
    let baseline = 0
    let lastMovement = started
    const transferred = () => entries.reduce((sum, entry) => sum + (entry.failed ? 0 : entry.loaded), 0)
    const resetEstimate = () => {
        started = Date.now()
        lastMovement = started
        baseline = transferred()
    }
    const report = () => {
        const totalBytes = entries.reduce((sum, entry) => sum + (entry.failed ? 0 : entry.file.size), 0)
        const loaded = transferred()
        const elapsed = (Date.now() - started) / 1000
        const rate = elapsed > 0 ? (loaded - baseline) / elapsed : 0
        const pending = entries.filter(entry => !entry.done)
        const processing = pending.length > 0 && pending.every(entry => entry.sent)
        onProgress({
            percent: totalBytes > 0 ? Math.floor(100 * loaded / totalBytes) : 0,
            completed: entries.filter(entry => entry.done && !entry.failed).length,
            failed: entries.filter(entry => entry.failed).length,
            total: files.length,
            remainingSeconds: !processing && elapsed >= 2 && Date.now() - lastMovement < 5000 && rate > 0 && totalBytes > loaded
                ? Math.ceil((totalBytes - loaded) / rate) : null,
            processing,
        })
    }
    const send = (entry: typeof entries[number]) => new Promise<{ status: number; data: any }>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        const update = (loaded: number) => {
            if (loaded > entry.loaded) lastMovement = Date.now()
            entry.loaded = loaded
        }
        xhr.upload.onprogress = event => {
            if (event.lengthComputable && event.total > 0) {
                update(entry.file.size * Math.min(1, event.loaded / event.total))
            }
        }
        xhr.upload.onload = () => {
            update(entry.file.size)
            entry.sent = true
        }
        xhr.onload = () => {
            let data: any = null
            try { data = JSON.parse(xhr.responseText) } catch {
                if (xhr.status >= 200 && xhr.status < 300) {
                    reject(new Error('Invalid upload response'))
                    return
                }
            }
            resolve({ status: xhr.status, data })
        }
        xhr.onerror = xhr.ontimeout = xhr.onabort = () => reject(new Error('Upload transport failed'))
        xhr.open('POST', url)
        const body = new FormData()
        body.append('file', entry.file)
        if (entry.file.relativePath) body.append('relativePath', entry.file.relativePath)
        if (folderId) body.append('folderId', folderId)
        xhr.send(body)
    })
    const worker = async () => {
        while (cursor < entries.length) {
            const entry = entries[cursor++]
            let succeeded = false
            for (let attempt = 0; attempt <= 3; attempt++) {
                try {
                    const response = await send(entry)
                    if (response.status >= 200 && response.status < 300) {
                        entry.loaded = entry.file.size
                        entry.sent = true
                        lastResult = response.data
                        succeeded = true
                        break
                    }
                    if (response.status >= 400 && response.status < 500) break
                } catch {
                    // Network and malformed success responses follow the existing retry policy.
                }
                if (attempt < 3) {
                    entry.loaded = 0
                    entry.sent = false
                    resetEstimate()
                    await new Promise(resolve => setTimeout(resolve, 400 * (attempt + 1)))
                }
            }
            entry.done = true
            entry.failed = !succeeded
            if (!succeeded) resetEstimate()
        }
    }
    report()
    const timer = setInterval(report, 250)
    try {
        await Promise.all(Array.from({ length: Math.min(6, files.length) }, () => worker()))
        report()
        return { lastResult, failed: entries.filter(entry => entry.failed).length }
    } finally {
        clearInterval(timer)
    }
}
