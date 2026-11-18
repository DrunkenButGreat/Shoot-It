// Uses the disposable schema and route harness from test-audit-integration.
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const sharp = require("sharp");
const { NextRequest } = require("next/server");
module.exports = async ({
  db,
  load,
  owner,
  outsider,
  a,
  b,
  params,
  request,
  signIn,
}) => {
  const planning = load("src/app/api/projects/[id]/plan/route"),
    calendar = load("src/app/api/projects/[id]/calendar/route"),
    delivery = load("src/app/api/delivery/[fileId]/route");
  const update = async (cmd, id = a.id) =>
    planning.POST(request(cmd), params(id));
  const dir = path.join("uploads", "results", a.id);
  await fs.mkdir(dir, { recursive: true });
  try {
    const original = await sharp({
      create: { width: 2000, height: 1000, channels: 3, background: "red" },
    })
      .png()
      .toBuffer();
    await fs.writeFile(path.join(dir, "demo.png"), original);
    const img = await db.selectionImage.create({
      data: { projectId: a.id, filename: "one.jpg", path: "/test/one" },
    });
    const file = await db.resultFile.create({
      data: {
        projectId: a.id,
        filename: "demo.png",
        path: "/api/uploads/results/" + a.id + "/demo.png",
      },
    });
    const fetchFile = (query = "") =>
      delivery.GET(
        new NextRequest("http://localhost/api/delivery/" + file.id + query),
        { params: Promise.resolve({ fileId: file.id }) },
      );
    signIn(owner);
    for (const kind of ["shot", "task"])
      assert.equal(
        (
          await update({
            action: "add",
            kind,
            title: "Motiv, eins;" + "ä".repeat(50),
            due: "2026-12-01",
          })
        ).status,
        204,
      );
    const task = await db.planItem.findFirstOrThrow({
      where: { projectId: a.id, kind: "task" },
    });
    const getCalendar = () => calendar.GET(request({}), params(a.id));
    const ics = await (await getCalendar()).text();
    assert.ok(ics.includes("TRIGGER:-P1D"));
    assert.ok(ics.includes("DTSTART;VALUE=DATE:20261201"));
    assert.ok(ics.includes("Motiv\\, eins\\;"));
    assert.ok(ics.split("\r\n").every((l) => Buffer.byteLength(l) <= 75));
    assert.equal(
      (await update({ action: "check", id: task.id, done: true })).status,
      204,
    );
    assert.ok(
      !(await (await getCalendar()).text()).includes(task.id + "@shoot-it"),
    );
    assert.equal(
      (await update({ action: "status", id: img.id, status: "editing" }))
        .status,
      204,
    );
    assert.equal(
      (await db.selectionImage.findUniqueOrThrow({ where: { id: img.id } }))
        .editStatus,
      "editing",
    );
    signIn(outsider);
    assert.equal((await update({ action: "remove", id: task.id })).status, 403);
    assert.equal(
      (await update({ action: "remove", id: task.id }, b.id)).status,
      404,
    );
    assert.equal((await getCalendar()).status, 403);
    assert.equal((await fetchFile()).status, 404);
    signIn(owner);
    const share = async (variant) =>
      (
        await (
          await update({ action: "share", id: file.id, days: 1, variant })
        ).json()
      ).path.split("?")[1];
    const key = await share("web");
    signIn(null);
    const web = await fetchFile("?" + key + "&variant=original");
    assert.equal(web.status, 200);
    const meta = await sharp(Buffer.from(await web.arrayBuffer())).metadata();
    assert.equal(meta.format, "jpeg");
    assert.equal(meta.width, 1600);
    signIn(owner);
    const newer = await share("original");
    signIn(null);
    assert.equal((await fetchFile("?" + key)).status, 404);
    assert.deepEqual(
      Buffer.from(await (await fetchFile("?" + newer)).arrayBuffer()),
      original,
    );
    await db.deliveryLink.update({
      where: { fileId: file.id },
      data: { expires: new Date(0) },
    });
    assert.equal((await fetchFile("?" + newer)).status, 404);
    signIn(owner);
    const last = await share("original");
    assert.equal((await update({ action: "revoke", id: file.id })).status, 204);
    assert.equal((await fetchFile("?" + last)).status, 404);
    assert.equal((await update({ action: "remove", id: task.id })).status, 204);
    await db.resultFile.delete({ where: { id: file.id } });
    await db.selectionImage.delete({ where: { id: img.id } });
    console.log(
      "PASS: planner CRUD, scope, status, ICS reminders and folding, real resized and original bytes, link rotation, expiry and revocation.",
    );
  } finally {
    await fs.rm(dir, { force: true, recursive: true });
    signIn(null);
  }
};
