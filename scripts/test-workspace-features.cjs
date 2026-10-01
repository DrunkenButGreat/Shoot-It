// Real PostgreSQL in a disposable schema; never touches application rows.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const Module = require('node:module');
const ts = require('typescript');
const sharp = require('sharp');
const { PrismaClient } = require('@prisma/client');
const { NextRequest } = require('next/server');

async function main() {
  const url = new URL(process.env.TEST_DATABASE_URL || 'invalid:');
  assert.match(url.protocol, /^postgres(ql)?:$/);
  assert.match(url.pathname, /_test$/);
  const schema = `workspace_test_${randomUUID().replaceAll('-', '')}`;
  url.searchParams.set('schema', schema);
  const db = new PrismaClient({ datasources: { db: { url: url.toString() } } });
  let session = null;
  const cache = new Map();
  function load(file) {
    const filename = ['', '.ts', '.json'].map(ext => path.resolve(file + ext)).find(fs.existsSync);
    if (filename === path.resolve('src/lib/prisma.ts')) return { __esModule: true, default: db };
    if (filename.endsWith('.json')) return JSON.parse(fs.readFileSync(filename, 'utf8'));
    if (cache.has(filename)) return cache.get(filename).exports;
    const mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
    mod.require = id => id === '@/auth' ? { auth: async () => session }
      : id === '@/lib/prisma' ? { __esModule: true, default: db }
      : id.startsWith('@/') ? load(`src/${id.slice(2)}`)
      : id.startsWith('.') ? load(path.resolve(path.dirname(filename), id)) : require(id);
    cache.set(filename, mod);
    mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
    } }).outputText, filename);
    return mod.exports;
  }
  const files = [];
  const testDir = path.resolve('uploads', schema);
  const params = id => ({ params: Promise.resolve({ id }) });
  const json = body => new NextRequest('http://localhost/test', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  try {
    execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], { env: { ...process.env, DATABASE_URL: url.toString() }, stdio: 'pipe' });
    const owner = await db.user.create({ data: { email: `${schema}@example.test`, isAdmin: true } });
    const outsider = await db.user.create({ data: { email: `other-${schema}@example.test` } });
    const a = await db.project.create({ data: { name: 'First', shortCode: `${schema}-a`, ownerId: owner.id } });
    const b = await db.project.create({ data: { name: 'Second', shortCode: `${schema}-b`, ownerId: outsider.id } });
    const visit = load('src/app/api/projects/[id]/visit/route').POST;
    const recent = load('src/app/api/projects/recent/route').GET;
    const cover = load('src/app/api/projects/[id]/branding/route');
    const appearance = load('src/app/api/admin/appearance/route');
    const site = load('src/lib/site-settings').getSiteImages;
    assert.equal((await visit(json({}), params(a.id))).status, 401);
    assert.equal((await appearance.PATCH(json({ slot: 'loginImage' }))).status, 403);
    session = { user: { id: owner.id } };
    assert.equal((await visit(json({}), params(b.id))).status, 403);
    await db.projectAccess.create({ data: { projectId: b.id, userId: owner.id } });
    await db.projectVisit.createMany({ data: [
      { projectId: a.id, userId: owner.id, openedAt: new Date('2026-01-01') },
      { projectId: b.id, userId: owner.id, openedAt: new Date('2026-01-02') },
    ] });
    assert.deepEqual((await (await recent()).json()).map(p => p.id), [b.id, a.id]);
    assert.equal((await visit(json({}), params(a.id))).status, 200);
    assert.deepEqual((await (await recent()).json()).map(p => p.id), [a.id, b.id]);
    assert.equal(await db.projectVisit.count(), 2);
    await db.projectAccess.deleteMany({ where: { projectId: b.id } });
    assert.deepEqual((await (await recent()).json()).map(p => p.id), [a.id]);
    session = { user: { id: outsider.id } };
    assert.deepEqual(await (await recent()).json(), []);
    assert.equal((await cover.GET(new NextRequest('http://localhost/?source=selection'), params(a.id))).status, 404);
    assert.equal((await appearance.PATCH(json({ slot: 'loginImage' }))).status, 403);
    session = { user: { id: owner.id } };
    fs.mkdirSync(testDir, { recursive: true });
    const imagePath = `/api/uploads/${schema}/sample.png`;
    await sharp({ create: { width: 20, height: 10, channels: 3, background: '#4676d8' } }).png().toFile(path.join(testDir, 'sample.png'));
    const group = await db.moodboardGroup.create({ data: { name: 'Mood', ownerId: owner.id, projectLinks: { create: { projectId: a.id } } } });
    const mood = await db.moodboardImage.create({ data: { groupId: group.id, filename: 'sample.png', path: imagePath } });
    const selection = await db.selectionImage.create({ data: { projectId: a.id, filename: 'sample.png', path: imagePath } });
    const result = await db.resultFile.create({ data: { projectId: a.id, filename: 'sample.png', path: imagePath } });
    const foreign = await db.selectionImage.create({ data: { projectId: b.id, filename: 'other.png', path: imagePath } });
    assert.equal((await cover.PATCH(json({ source: 'selection', imageId: foreign.id }), params(a.id))).status, 404);
    for (const [source, image] of [['moodboard', mood], ['selection', selection], ['results', result]]) {
      const list = await (await cover.GET(new NextRequest(`http://localhost/?source=${source}`), params(a.id))).json();
      assert.deepEqual(list.images.map(i => i.id), [image.id]);
      const response = await cover.PATCH(json({ source, imageId: image.id }), params(a.id));
      assert.equal(response.status, 200);
      const { url: saved } = await response.json();
      const target = path.resolve('uploads', saved.slice('/api/uploads/'.length)); files.push(target);
      assert.equal((await sharp(target).metadata()).format, 'webp');
      assert.equal((await db.project.findUnique({ where: { id: a.id } })).brandingImage, saved);
      assert.ok(fs.existsSync(path.join(testDir, 'sample.png')));
    }

    const portrait = load('src/app/api/projects/[id]/participants/[participantId]/image/route').POST;
    const person = await db.participant.create({ data: { projectId: a.id, name: 'Portrait test', userId: outsider.id } });
    const portraitParams = (projectId = a.id) => ({ params: Promise.resolve({ id: projectId, participantId: person.id }) });
    const portraitRequest = (file = new File([fs.readFileSync(path.join(testDir, 'sample.png'))], 'sample.png', { type: 'image/png' })) => {
      const body = new FormData(); body.set('file', file);
      return new Request('http://localhost/test', { method: 'POST', body });
    };
    session = null;
    assert.equal((await portrait(portraitRequest(), portraitParams())).status, 401);
    session = { user: { id: outsider.id } };
    assert.equal((await portrait(portraitRequest(), portraitParams())).status, 403);
    assert.equal((await portrait(portraitRequest(), portraitParams(b.id))).status, 404);
    await db.projectAccess.create({ data: { projectId: a.id, userId: outsider.id, role: 'VIEWER' } });
    assert.equal((await portrait(portraitRequest(), portraitParams())).status, 403);
    await db.projectAccess.update({ where: { projectId_userId: { projectId: a.id, userId: outsider.id } }, data: { role: 'EDITOR' } });
    const response = await portrait(portraitRequest(), portraitParams());
    assert.equal(response.status, 201);
    const photo = await response.json();
    files.push(path.resolve('uploads', photo.path.slice('/api/uploads/'.length)));
    assert.equal((await sharp(files.at(-1)).metadata()).format, 'webp');
    assert.equal((await db.participant.findUnique({ where: { id: person.id }, include: { images: true } })).images[0].path, photo.path);
    assert.equal((await db.user.findUnique({ where: { id: outsider.id } })).image, null);
    assert.equal((await portrait(portraitRequest(new File(['bad'], 'bad.png', { type: 'image/png' })), portraitParams())).status, 400);
    assert.equal((await portrait(portraitRequest(new File([Buffer.alloc(5 * 1024 * 1024 + 1)], 'big.png', { type: 'image/png' })), portraitParams())).status, 400);
    assert.equal(await db.participantImage.count({ where: { participantId: person.id } }), 1);
    session = { user: { id: owner.id } };
    assert.equal((await site()).loginImage, '/images/design/coastal-portrait.webp');
    const form = new FormData(); form.set('slot', 'loginImage');
    form.set('file', new File([fs.readFileSync(path.join(testDir, 'sample.png'))], 'sample.png', { type: 'image/png' }));
    const savedResponse = await appearance.POST(new Request('http://localhost/test', { method: 'POST', body: form }));
    assert.equal(savedResponse.status, 200);
    const savedImages = await savedResponse.json();
    files.push(path.resolve('uploads', savedImages.loginImage.slice('/api/uploads/'.length)));
    assert.equal((await site()).loginImage, savedImages.loginImage);
    assert.equal((await appearance.PATCH(json({ slot: 'invalid' }))).status, 400);
    await appearance.PATCH(json({ slot: 'loginImage' }));
    assert.equal((await site()).loginImage, '/images/design/coastal-portrait.webp');
    form.set('file', new File(['not an image'], 'sample.png', { type: 'image/png' }));
    assert.equal((await appearance.POST(new Request('http://localhost/test', { method: 'POST', body: form }))).status, 400);
    console.log('Workspace checks passed: migration, per-user recency, revoked access, cover sources, cross-project denial, admin images and reset, participant portraits and editor permissions.');
  } finally {
    for (const file of files) fs.rmSync(file, { force: true });
    fs.rmSync(testDir, { recursive: true, force: true });
    await db.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await db.$disconnect();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
