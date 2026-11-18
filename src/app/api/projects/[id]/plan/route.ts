import { NextRequest, NextResponse } from "next/server";
import { randomBytes, createHash } from "node:crypto";
import { z } from "zod";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { canEditProject } from "@/lib/permissions";

const id = z.string().min(1).max(128);
const command = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("add"),
    kind: z.enum(["shot", "task"]),
    title: z.string().trim().min(1).max(240),
    due: z.iso.date().nullable(),
  }),
  z.object({ action: z.literal("check"), id, done: z.boolean() }),
  z.object({ action: z.literal("remove"), id }),
  z.object({
    action: z.literal("status"),
    id,
    status: z.enum(["pending", "editing", "ready"]),
  }),
  z.object({
    action: z.literal("share"),
    id,
    variant: z.enum(["original", "web"]),
    days: z.number().int().min(1).max(30),
  }),
  z.object({ action: z.literal("revoke"), id }),
]);
export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: projectId } = await ctx.params;
  const userId = (await auth())?.user?.id;
  if (!userId || !(await canEditProject(userId, projectId)))
    return new NextResponse(null, { status: 403 });
  const parsed = command.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return new NextResponse(null, { status: 400 });
  const c = parsed.data;
  let count = 1;
  if (c.action === "add")
    await prisma.planItem.create({
      data: {
        projectId,
        kind: c.kind,
        title: c.title,
        due: c.due ? new Date(c.due) : null,
      },
    });
  if (c.action === "check")
    count = (
      await prisma.planItem.updateMany({
        where: { projectId, id: c.id },
        data: { done: c.done },
      })
    ).count;
  if (c.action === "remove")
    count = (
      await prisma.planItem.deleteMany({ where: { projectId, id: c.id } })
    ).count;
  if (c.action === "status")
    count = (
      await prisma.selectionImage.updateMany({
        where: { projectId, id: c.id },
        data: { editStatus: c.status },
      })
    ).count;
  if (c.action === "revoke")
    count = (
      await prisma.deliveryLink.deleteMany({
        where: { fileId: c.id, file: { projectId } },
      })
    ).count;
  if (c.action === "share") {
    const file = await prisma.resultFile.findFirst({
      where: { projectId, id: c.id },
      select: { isVideo: true },
    });
    if (!file || (file.isVideo && c.variant === "web"))
      return new NextResponse(null, { status: 400 });
    const token = randomBytes(32).toString("base64url");
    const data = {
      digest: createHash("sha256").update(token).digest("hex"),
      variant: c.variant,
      expires: new Date(Date.now() + c.days * 86400000),
    };
    await prisma.deliveryLink.upsert({
      where: { fileId: c.id },
      create: { fileId: c.id, ...data },
      update: data,
    });
    return NextResponse.json(
      { path: "/api/delivery/" + c.id + "?key=" + token },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
  return new NextResponse(null, { status: count ? 204 : 404 });
}
