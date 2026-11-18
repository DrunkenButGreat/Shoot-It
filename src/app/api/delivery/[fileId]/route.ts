import { NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { open, realpath } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import sharp from "sharp";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { canAccessProject } from "@/lib/permissions";

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ fileId: string }> },
) {
  const { fileId } = await ctx.params;
  const query = request.nextUrl.searchParams;
  const denied = () =>
    new Response(null, {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  const file = await prisma.resultFile.findUnique({
    where: { id: fileId },
    include: { delivery: true },
  });
  if (!file) return denied();
  let variant = query.get("variant") || "original";
  if (query.has("key")) {
    const token = query.get("key")!;
    if (
      !/^[\w-]{43}$/.test(token) ||
      !file.delivery ||
      file.delivery.expires <= new Date() ||
      file.delivery.digest !== createHash("sha256").update(token).digest("hex")
    )
      return denied();
    variant = file.delivery.variant;
  } else {
    const user = (await auth())?.user?.id;
    if (!user || !(await canAccessProject(user, file.projectId)))
      return denied();
  }
  if (
    !["original", "web"].includes(variant) ||
    (variant === "web" && file.isVideo)
  )
    return denied();
  const prefix = "/api/uploads/results/" + file.projectId + "/";
  if (!file.path.startsWith(prefix)) return denied();
  const parts = file.path.slice(prefix.length).split("/");
  if (parts.some((p) => !p || p.startsWith(".") || /[\\\0]/.test(p)))
    return denied();
  try {
    const root = await realpath("uploads");
    const projectDir = path.join(root, "results", file.projectId);
    const resolved = await realpath(path.join(projectDir, ...parts));
    if (!resolved.startsWith(projectDir + path.sep)) return denied();
    const web = variant === "web";
    const filename = web
      ? path.parse(file.filename).name + "-web.jpg"
      : file.filename;
    const headers = {
      "Content-Type": web ? "image/jpeg" : "application/octet-stream",
      "Content-Disposition":
        "attachment; filename*=UTF-8''" +
        encodeURIComponent(filename).replace(
          /['()*]/g,
          (c) => "%" + c.charCodeAt(0).toString(16),
        ),
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    };
    if (web)
      return new Response(
        new Uint8Array(
          await sharp(resolved)
            .rotate()
            .resize({
              width: 1600,
              height: 1600,
              fit: "inside",
              withoutEnlargement: true,
            })
            .jpeg({ quality: 82 })
            .toBuffer(),
        ),
        { headers },
      );
    const handle = await open(resolved);
    return new Response(
      Readable.toWeb(
        handle.createReadStream({ signal: request.signal }),
      ) as ReadableStream,
      { headers },
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return denied();
    return new Response(null, { status: 422 });
  }
}
