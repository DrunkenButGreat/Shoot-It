const assert = require('node:assert/strict')
const { NextRequest } = require('next/server')

module.exports = async function check({ db, load, owner, outsider, params, request, signIn }) {
  const source = await db.project.create({ data: { ownerId: owner.id, name: 'Template', shortCode: 'template', date: new Date('2026-01-10'),
    isPublic: true, showSelectionPublicly: true, allowGuestSelection: true, selectionTarget: 2,
    selectionFolders: { create: { name: 'Folder', path: '/folder' } },
    contracts: { create: [{ title: 'Draft', content: 'Terms' }, { title: 'Signed', content: 'Personalized', signatures: { create: { name: 'Person', email: 'p@example.test', signature: 'signed' } } }] },
    callsheet: { create: { callTime: new Date('2026-01-10T08:00Z'), emergencyPhone: 'private', scheduleItems: { create: { time: new Date('2026-01-11T08:30Z'), activity: 'Shoot' } } } },
    moodboardLinks: { create: { group: { create: { name: 'Mood', ownerId: owner.id } } } },
  }, include: { selectionFolders: true } })
  const folderId = source.selectionFolders[0].id, ctx = params(source.id)
  const [a,b] = await Promise.all(['a','b'].map(filename => db.selectionImage.create({ data: { projectId: source.id, folderId, filename, path: `/test/${filename}` } })))
  const proof = load('src/app/api/projects/[id]/proof/route'), template = load('src/app/api/projects/[id]/template/route')
  const get = cookie => proof.GET(new NextRequest('http://localhost/proof', { headers: { cookie } }), ctx)
  const cmd = (body, cookie = '') => proof.POST(new NextRequest('http://localhost/proof', { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify(body) }), ctx)
  const cookie = async () => `shootit_proof=${(await get('')).cookies.get('shootit_proof').value}`
  const x = await cookie(), y = await cookie(); assert.notEqual(x,y)
  assert.equal((await cmd({ action: 'pick', imageId: a.id, value: true })).status, 409)
  assert.equal((await cmd({ action: 'pick', imageId: a.id, value: true }, x)).status, 200)
  assert.equal((await cmd({ action: 'submit', name: 'One' }, x)).status, 409)
  assert.equal((await cmd({ action: 'note', imageId: a.id, text: 'Crop left' }, x)).status, 200)
  assert.equal((await (await get(y)).json()).mine, null)
  assert.equal((await cmd({ action: 'pick', imageId: a.id, value: true }, y)).status, 200)
  await cmd({ action: 'pick', imageId: b.id, value: true }, x)
  const submissions = await Promise.all([1,2].map(() => cmd({ action: 'submit', name: 'One' }, x)))
  assert.deepEqual(submissions.map(r => r.status).sort(), [200,409])
  const { mine, lists } = await (await get(x)).json(); assert.deepEqual(lists, []); assert.equal(mine.name,'One')
  for (const body of [{ action: 'pick', imageId: a.id, value: false }, { action: 'note', imageId: a.id, text: 'Later' }]) assert.equal((await cmd(body,x)).status,409)
  assert.equal((await cmd({ action: 'reopen', listId: mine.id }, y)).status,403)
  signIn(owner)
  const overview = await (await get('')).json(); assert.equal(overview.lists.filter(l => l.picks.some(p => p.imageId === a.id)).length,2)
  assert.equal((await cmd({ action: 'resolve', noteId: mine.notes[0].id, done: true })).status,200)
  const bulk = load('src/app/api/projects/[id]/selection/images/bulk/route'), folder = load('src/app/api/projects/[id]/selection/folders/[folderId]/route')
  assert.equal((await bulk.DELETE(request({ ids: [a.id] }),ctx)).status,409)
  assert.equal((await folder.DELETE(request({}),params(source.id,{folderId}))).status,409)
  assert.equal((await cmd({ action: 'reopen', listId: mine.id })).status,200)
  signIn(null); assert.equal((await cmd({ action: 'pick', imageId: a.id, value: false }, x)).status,200)
  signIn(owner); assert.equal((await cmd({ action: 'settings', target: 3, due: '2026-03-01' })).status,200)
  const make = () => template.POST(request({ name: 'Copy', date: '2026-06-10', zone: 'Europe/Berlin' }),ctx)
  assert.equal((await make()).status,404); assert.equal((await template.PATCH(request({ isTemplate: true }),ctx)).status,200)
  signIn(outsider); assert.equal((await make()).status,404); assert.equal((await template.PATCH(request({ isTemplate: false }),ctx)).status,404)
  signIn(owner); const created = await make(); assert.equal(created.status,201)
  const copy = await db.project.findUniqueOrThrow({ where: { id: (await created.json()).id }, include: { callsheet: { include: { scheduleItems: true } }, contracts: true, moodboardLinks: true, _count: { select: { selectionImages: true, proofLists: true, participants: true, access: true } } } })
  assert.equal(copy.isPublic,false); assert.equal(copy.isTemplate,false); assert.notEqual(copy.shortCode,source.shortCode); assert.equal(copy.selectionTarget,3); assert.equal(copy.selectionDue,null)
  assert.deepEqual(Object.values(copy._count),[0,0,0,0]); assert.deepEqual(copy.contracts.map(c => c.title),['Draft']); assert.equal(copy.moodboardLinks.length,1)
  assert.equal(copy.callsheet.emergencyPhone,null); assert.equal(copy.callsheet.callTime.toISOString(),'2026-06-10T07:00:00.000Z'); assert.equal(copy.callsheet.scheduleItems[0].time.toISOString(),'2026-06-11T07:30:00.000Z')
  signIn(null); assert.equal((await proof.GET(request({}),params(copy.id))).status,403)
  console.log('PASS: independent guests, count, simultaneous submissions, locked edits and deletes, reopen, feedback and private templates across DST.')
}
