const { version } = require('../package.json')

fetch('http://127.0.0.1:3000/api/ready', { signal: AbortSignal.timeout(5000) })
  .then(async response => {
    if (!response.ok) throw new Error('Not ready')
    const body = await response.json()
    if (body.status !== 'ok' || body.version !== version) throw new Error('Unexpected version')
  })
  .catch(() => { process.exitCode = 1 })
